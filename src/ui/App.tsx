import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import './App.css'
import { applyMove, beginTurn } from '../core/apply.ts'
import { legalMoves } from '../core/moves.ts'
import { createGame, TOTAL_TURNS } from '../core/setup.ts'
import type { CardInstance, GameState, Move, ZoneKey } from '../core/types.ts'
import { PLAYER_LABELS } from '../labels.ts'
import { Board } from './Board.tsx'
import { Card } from './Card.tsx'
import { CardDetail } from './CardDetail.tsx'
import type { HoveredCard } from './CardDetail.tsx'
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
import { useCardDrag } from './useCardDrag.ts'

/** 詳細オーバーレイを出すまでの待ち時間。盤面を横切るたびの点滅を防ぐ */
const HOVER_DELAY_MS = 120

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
  const [hovered, setHovered] = useState<HoveredCard | null>(null)

  const state = history[history.length - 1]
  const playing = state.phase === 'playing'
  const moves = useMemo(() => (playing ? legalMoves(state) : []), [state, playing])

  // ── 詳細オーバーレイ ────────────────────────────────────────────
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearHoverTimer = useCallback(() => {
    if (hoverTimer.current !== null) {
      clearTimeout(hoverTimer.current)
      hoverTimer.current = null
    }
  }, [])

  const handleHover = useCallback(
    (card: CardInstance | null, rect?: DOMRect) => {
      clearHoverTimer()
      if (card === null || rect === undefined) {
        setHovered(null)
        return
      }
      hoverTimer.current = setTimeout(() => setHovered({ card, rect }), HOVER_DELAY_MS)
    },
    [clearHoverTimer],
  )

  useEffect(() => clearHoverTimer, [clearHoverTimer])

  // ── 着手 ────────────────────────────────────────────────────────
  const commit = useCallback(
    (move: Move) => {
      const after = applyMove(state, move)
      setHistory((h) => [...h, after.phase === 'playing' ? beginTurn(after) : after])
      setSelection(START)
      setHovered(null)
    },
    [state],
  )

  const applyPick = useCallback(
    (p: Pick, from: Selection) => {
      const next = advanceSelection(moves, from, p)
      if ('step' in next) setSelection(next)
      else commit(next)
    },
    [moves, commit],
  )

  const pick = useCallback((p: Pick) => applyPick(p, selection), [applyPick, selection])

  // ── ドラッグ&ドロップ ───────────────────────────────────────────
  const { drag, ghostRef, handlers } = useCardDrag({
    onDragStart: (cardUid) => {
      clearHoverTimer()
      setHovered(null)
      setSelection({ step: 'zone', cardUid })
    },
    // 選択 state の反映を待たずに済むよう、ドラッグ中のカードから直接組み立てる
    droppableZones: (cardUid) => selectableZones(moves, { step: 'zone', cardUid }),
    onDrop: (zone, cardUid) => applyPick({ zone }, { step: 'zone', cardUid }),
    onClick: (cardUid) => applyPick({ cardUid }, START),
    onCancel: () => setSelection(START),
  })

  // ── 履歴操作 ────────────────────────────────────────────────────
  function undo() {
    if (history.length <= 1) return
    setHistory(history.slice(0, -1))
    setSelection(START)
    setHovered(null)
  }

  function restart(newSeed: number) {
    setSeed(newSeed)
    setHistory([startGame(newSeed)])
    setSelection(START)
    setHovered(null)
  }

  const selectedUid = selection.step === 'card' ? null : selection.cardUid
  const handSelectable = (p: 0 | 1) =>
    playing && state.current === p ? selectableCards(moves) : new Set<number>()
  const dragOverZone: ZoneKey | null = drag?.over ?? null

  return (
    <div className={`app ${drag !== null ? 'app--dragging' : ''}`}>
      <header className="topbar">
        <h1 className="topbar__logo">MULTIPLY</h1>
        <span className="topbar__turn">
          ターン {state.turn} / {TOTAL_TURNS}
        </span>
        <span className="topbar__current">
          {playing ? `${PLAYER_LABELS[state.current]} の手番` : '決着'}
        </span>
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

      {!playing && <Result state={state} onRestart={() => restart(randomSeed())} />}

      <Hand
        state={state}
        player={1}
        selectableUids={handSelectable(1)}
        selectedUid={state.current === 1 ? selectedUid : null}
        draggingUid={drag?.cardUid ?? null}
        dragHandlers={handlers}
        onSelect={(cardUid) => applyPick({ cardUid }, START)}
        onHover={handleHover}
      />

      <Board
        state={state}
        placeableZones={selectableZones(moves, selection)}
        movableZones={selectableMoveTos(moves, selection)}
        targetUids={selectableTargets(moves, selection)}
        dragOverZone={dragOverZone}
        onSelectZone={(zone) => pick({ zone })}
        onSelectMoveTo={(moveTo) => pick({ moveTo })}
        onSelectTarget={(targetUid) => pick({ targetUid })}
        onHover={handleHover}
      />

      <Hand
        state={state}
        player={0}
        selectableUids={handSelectable(0)}
        selectedUid={state.current === 0 ? selectedUid : null}
        draggingUid={drag?.cardUid ?? null}
        dragHandlers={handlers}
        onSelect={(cardUid) => applyPick({ cardUid }, START)}
        onHover={handleHover}
      />

      <Log state={state} />

      <footer className="seedline">
        シード {seed}
        <button type="button" onClick={() => restart(seed)}>
          同じ配りで最初から
        </button>
      </footer>

      {drag !== null && <DragGhost state={state} cardUid={drag.cardUid} ghostRef={ghostRef} />}
      {/* ドラッグ中は詳細を出さない。ref ではなく描画時の導出なのでリセット漏れが起きない */}
      <CardDetail hovered={drag !== null ? null : hovered} />
    </div>
  )
}

/**
 * ポインタに追従するドラッグ中のカード。
 * 座標は useCardDrag が ref 経由で transform に直接書くので、React state にはしない。
 */
function DragGhost({
  state,
  cardUid,
  ghostRef,
}: {
  state: GameState
  cardUid: number
  ghostRef: RefObject<HTMLDivElement | null>
}) {
  const card = state.hands[state.current].find((c) => c.uid === cardUid)
  if (card === undefined) return null

  return (
    <div className="drag-ghost" ref={ghostRef} aria-hidden="true">
      <Card card={card} size="hand" />
    </div>
  )
}
