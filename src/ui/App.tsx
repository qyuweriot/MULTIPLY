import { useMemo, useState } from 'react'
import './App.css'
import { applyMove, beginTurn } from '../core/apply.ts'
import { defOf } from '../core/cards.ts'
import { legalMoves } from '../core/moves.ts'
import { createGame, TOTAL_TURNS } from '../core/setup.ts'
import type { CardInstance, GameState, Move, PlayerId } from '../core/types.ts'
import { zonesOf } from '../core/types.ts'
import { score, zoneTotal } from '../core/value.ts'
import { PLAYER_LABELS, ZONE_LABELS } from '../labels.ts'
import { Board } from './Board.tsx'
import { Card } from './Card.tsx'
import { Deck } from './Deck.tsx'
import { Hand } from './Hand.tsx'
import { Log } from './Log.tsx'
import { Result } from './Result.tsx'
import { TargetPicker } from './TargetPicker.tsx'
import type { Pick, Selection } from './selection.ts'
import {
  advanceSelection,
  backSelection,
  selectableCards,
  selectableMoveTos,
  selectableTargets,
  selectableZones,
  START,
} from './selection.ts'

/** state はつねに「現在のプレイヤーがドロー済みで、すぐ打てる」状態に保つ */
function startGame(seed: number): GameState {
  return beginTurn(createGame(seed))
}

function randomSeed(): number {
  return Math.floor(Date.now() % 1_000_000)
}

export default function App() {
  const [seed, setSeed] = useState(randomSeed)
  const [history, setHistory] = useState<GameState[]>(() => [startGame(seed)])
  const [selection, setSelection] = useState<Selection>(START)
  const [preview, setPreview] = useState<CardInstance | null>(null)

  const state = history[history.length - 1]
  const playing = state.phase === 'playing'
  const moves = useMemo(() => (playing ? legalMoves(state) : []), [state, playing])

  function commit(move: Move) {
    const after = applyMove(state, move)
    setHistory([...history, after.phase === 'playing' ? beginTurn(after) : after])
    setSelection(START)
    setPreview(null)
  }

  function pick(p: Pick) {
    const next = advanceSelection(moves, selection, p)
    if ('step' in next) setSelection(next)
    else commit(next)
  }

  function undo() {
    if (history.length <= 1) return
    setHistory(history.slice(0, -1))
    setSelection(START)
  }

  function restart(newSeed: number) {
    setSeed(newSeed)
    setHistory([startGame(newSeed)])
    setSelection(START)
    setPreview(null)
  }

  const selectedUid = selection.step === 'card' ? null : selection.cardUid
  const previewCard =
    preview ??
    (selectedUid !== null
      ? (state.hands[state.current].find((c) => c.uid === selectedUid) ?? null)
      : null)

  return (
    <div className="app">
      <div className="app__main">
        <header className="topbar">
          <h1 className="topbar__logo">MULTIPLY</h1>
          <span className="topbar__turn">
            ターン {state.turn} / {TOTAL_TURNS}
          </span>
          <span className="topbar__current">
            {playing ? `${PLAYER_LABELS[state.current]} の手番` : '決着'}
          </span>
          <span className="topbar__deck">山札 {state.deck.length}</span>
          <div className="topbar__actions">
            <button type="button" onClick={undo} disabled={history.length <= 1}>
              1手戻す
            </button>
            <button type="button" onClick={() => restart(randomSeed())}>
              新規ゲーム
            </button>
          </div>
        </header>

        {playing && (
          <TargetPicker
            state={state}
            selection={selection}
            onBack={() => setSelection(backSelection(selection))}
            onReset={() => setSelection(START)}
          />
        )}

        <Hand
          state={state}
          player={1}
          selectableUids={playing && state.current === 1 ? selectableCards(moves) : new Set()}
          selectedUid={state.current === 1 ? selectedUid : null}
          onSelect={(cardUid) => pick({ cardUid })}
          onHover={setPreview}
        />

        <Board
          state={state}
          placeableZones={selectableZones(moves, selection)}
          movableZones={selectableMoveTos(moves, selection)}
          targetUids={selectableTargets(moves, selection)}
          onSelectZone={(zone) => pick({ zone })}
          onSelectMoveTo={(moveTo) => pick({ moveTo })}
          onSelectTarget={(targetUid) => pick({ targetUid })}
          onHover={setPreview}
        />

        <Hand
          state={state}
          player={0}
          selectableUids={playing && state.current === 0 ? selectableCards(moves) : new Set()}
          selectedUid={state.current === 0 ? selectedUid : null}
          onSelect={(cardUid) => pick({ cardUid })}
          onHover={setPreview}
        />
      </div>

      <aside className="app__side">
        <section className="scores">
          <h2 className="panel__title">得点</h2>
          {([0, 1] as PlayerId[]).map((p) => {
            const [z0, z1] = zonesOf(p)
            return (
              <p key={p} className={`scores__row ${state.current === p && playing ? 'is-turn' : ''}`}>
                <span className="scores__name">{PLAYER_LABELS[p]}</span>
                <span className="scores__calc">
                  {ZONE_LABELS.z0} {zoneTotal(state, z0)} × {ZONE_LABELS.z1} {zoneTotal(state, z1)} =
                </span>
                <b className="scores__value">{score(state, p)}</b>
              </p>
            )
          })}
        </section>

        {!playing && <Result state={state} onRestart={() => restart(randomSeed())} />}

        <Deck state={state} />

        <section className="detail">
          <h2 className="panel__title">カード詳細</h2>
          {previewCard ? (
            <>
              <Card card={previewCard} size="hand" />
              <p className="detail__name">
                {defOf(previewCard).name}（{defOf(previewCard).reading}）
              </p>
              <p className="detail__text">{defOf(previewCard).text}</p>
            </>
          ) : (
            <p className="detail__hint">カードにカーソルを合わせると詳細が出ます</p>
          )}
        </section>

        <Log state={state} />

        <p className="seedline">
          シード {seed}
          <button type="button" onClick={() => restart(seed)}>
            同じ配りで最初から
          </button>
        </p>
      </aside>
    </div>
  )
}
