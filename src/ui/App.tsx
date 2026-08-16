import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import './App.css'
import './effects.css'
import { chooseMove, DIFFICULTIES } from '../ai/search.ts'
import type { Difficulty } from '../ai/search.ts'
import { visibleTo } from '../ai/view.ts'
import { applyMove, beginTurn } from '../core/apply.ts'
import { legalMoves } from '../core/moves.ts'
import { seedFrom } from '../core/rng.ts'
import { createGame, TOTAL_TURNS } from '../core/setup.ts'
import type { CardInstance, GameState, Move, PlayerId, ZoneKey } from '../core/types.ts'
import { DIFFICULTY_LABELS, PLAYER_LABELS } from '../labels.ts'
import { Board } from './Board.tsx'
import { Card } from './Card.tsx'
import { CardDetail } from './CardDetail.tsx'
import type { HoveredCard } from './CardDetail.tsx'
import { EffectLayer } from './EffectLayer.tsx'
import type { EffectEvent, MotionMode } from './effects.ts'
import { BOARD_MS, CUTIN_MS, describeEffect } from './effects.ts'
import { Hand } from './Hand.tsx'
import { Log } from './Log.tsx'
import { Result } from './Result.tsx'
import { TargetPicker } from './TargetPicker.tsx'
import { useBoardTransition } from './useBoardTransition.ts'
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

/** CPU が着手するまでの間。人間が盤面の変化を追えるようにする */
const CPU_DELAY_MS = 600

/** CPU が担当するプレイヤー */
const CPU_PLAYER: PlayerId = 1

/** 演出の ON/OFF を次回起動まで覚えておく */
const FX_KEY = 'multiply:fx'

type Opponent = 'human' | Difficulty

/** AI の乱数はゲーム本体の state.rng とは別系統にする */
const aiSeedFor = (seed: number) => seedFrom(seed ^ 0x5eed)

/** state はつねに「現在のプレイヤーがドロー済みで、すぐ打てる」状態に保つ */
function startGame(seed: number): GameState {
  return beginTurn(createGame(seed))
}

function randomSeed(): number {
  return Math.floor(Date.now() % 1_000_000)
}

function initialFxOn(): boolean {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(FX_KEY) !== 'off'
}

/** OS の「視差効果を減らす」設定。有効なら演出は一切動かさない */
function initialReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * 演出の再生状態。
 *
 * seq は着手・巻き戻し・再開のたびに増える。useBoardTransition はこれが変わったときだけ
 * カードを動かすので、「ホバーしただけで盤面が動く」ということが起きない。
 */
interface Playback {
  seq: number
  /** 巻き戻し・再開のときは null（カットインを出さずに位置だけ追従させる） */
  event: EffectEvent | null
  phase: 'idle' | 'cutin' | 'board'
  mode: MotionMode
}

const IDLE: Playback = { seq: 0, event: null, phase: 'idle', mode: 'off' }

export default function App() {
  const [seed, setSeed] = useState(randomSeed)
  const [history, setHistory] = useState<GameState[]>(() => [startGame(seed)])
  const [selection, setSelection] = useState<Selection>(START)
  const [hovered, setHovered] = useState<HoveredCard | null>(null)
  const [opponent, setOpponent] = useState<Opponent>('human')
  const aiRng = useRef(aiSeedFor(seed))

  const state = history[history.length - 1]
  const playing = state.phase === 'playing'
  const moves = useMemo(() => (playing ? legalMoves(state) : []), [state, playing])

  // ── 演出 ────────────────────────────────────────────────────────
  const [fxOn, setFxOn] = useState(initialFxOn)
  const [reducedMotion] = useState(initialReducedMotion)
  const [playback, setPlayback] = useState<Playback>(IDLE)
  const ghostLayerRef = useRef<HTMLDivElement | null>(null)

  const mode: MotionMode = reducedMotion ? 'off' : fxOn ? 'full' : 'quick'
  const busy = playback.phase !== 'idle'
  // 盤面・手札に重ねる固有モーションは、尺の長い「派手」のときだけ出す
  // （effects.css の animation-delay がカットインの尺前提で書かれているため）
  const boardFx = playback.mode === 'full' ? playback.event : null

  const transition = useBoardTransition(
    playback.seq,
    playback.event,
    ghostLayerRef,
    playback.mode,
  )

  // カットイン（CUTIN_MS）→ 盤面演出（BOARD_MS）→ 待機、と1段ずつ進める
  useEffect(() => {
    if (playback.phase === 'idle') return
    const ms = playback.phase === 'cutin' ? CUTIN_MS : BOARD_MS
    const timer = setTimeout(() => {
      setPlayback((p) =>
        p.seq !== playback.seq ? p : { ...p, phase: p.phase === 'cutin' ? 'board' : 'idle' },
      )
    }, ms)
    return () => clearTimeout(timer)
  }, [playback.phase, playback.seq])

  const skipFx = useCallback(() => {
    transition.skip()
    setPlayback((p) => ({ ...p, phase: 'idle' }))
  }, [transition])

  /** 巻き戻し・再開。カットインは出さず、カードの位置だけ追従させる */
  const resetFx = useCallback(() => {
    transition.skip()
    setPlayback((p) => ({
      seq: p.seq + 1,
      event: null,
      phase: 'idle',
      mode: reducedMotion ? 'off' : 'quick',
    }))
  }, [transition, reducedMotion])

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
      // 演出イベントは beginTurn より前に作る。ドロー後の盤面と比べると、
      // 疾風の手札交換と次ターンのドローが混ざって差分が読めなくなる
      const after = applyMove(state, move)
      setPlayback((p) => {
        const event = describeEffect(state, after, p.seq + 1)
        return {
          seq: p.seq + 1,
          event,
          phase: mode === 'off' || event === null ? 'idle' : mode === 'full' ? 'cutin' : 'board',
          mode,
        }
      })
      setHistory((h) => [...h, after.phase === 'playing' ? beginTurn(after) : after])
      setSelection(START)
      setHovered(null)
    },
    [state, mode],
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

  // ── CPU の手番 ──────────────────────────────────────────────────
  const cpuTurn = opponent !== 'human' && playing && state.current === CPU_PLAYER

  useEffect(() => {
    // 演出の再生中は思考に入らない。カットインの裏で盤面が進むのを防ぐ
    if (!cpuTurn || busy) return
    const difficulty = opponent as Difficulty
    const timer = setTimeout(() => {
      // 渡すのは PublicView だけ。CPU は山札の順序を見られない（§1-4）
      const { move, rng } = chooseMove(visibleTo(state, CPU_PLAYER), difficulty, aiRng.current)
      aiRng.current = rng
      commit(move)
    }, CPU_DELAY_MS)
    return () => clearTimeout(timer)
  }, [cpuTurn, busy, opponent, state, commit])

  // ── 履歴操作 ────────────────────────────────────────────────────
  function undo() {
    if (history.length <= 1) return
    let h = history.slice(0, -1)
    // CPU戦では、人間の手番に戻るまで巻き戻す
    while (opponent !== 'human' && h.length > 1) {
      const top = h[h.length - 1]
      if (top.phase !== 'playing' || top.current !== CPU_PLAYER) break
      h = h.slice(0, -1)
    }
    setHistory(h)
    setSelection(START)
    setHovered(null)
    resetFx()
  }

  function restart(newSeed: number) {
    setSeed(newSeed)
    aiRng.current = aiSeedFor(newSeed)
    setHistory([startGame(newSeed)])
    setSelection(START)
    setHovered(null)
    resetFx()
  }

  function changeOpponent(next: Opponent) {
    setOpponent(next)
    setSelection(START)
    setHovered(null)
  }

  function toggleFx(on: boolean) {
    setFxOn(on)
    if (typeof window !== 'undefined') window.localStorage.setItem(FX_KEY, on ? 'on' : 'off')
    if (!on) skipFx()
  }

  const selectedUid = selection.step === 'card' ? null : selection.cardUid
  const humanControls = (p: PlayerId) => opponent === 'human' || p !== CPU_PLAYER
  const handSelectable = (p: PlayerId) =>
    playing && state.current === p && humanControls(p)
      ? selectableCards(moves)
      : new Set<number>()
  const dragOverZone: ZoneKey | null = drag?.over ?? null

  /** 平原は使用者の手札、疾風は両者の手札に重ねる */
  const handFx = (p: PlayerId) => {
    if (boardFx === null) return null
    const mine = boardFx.cardId === 'heigen' && boardFx.player === p
    if (!mine && boardFx.cardId !== 'shippu') return null
    return { cardId: boardFx.cardId, seq: boardFx.seq }
  }

  return (
    <div className={`app ${drag !== null ? 'app--dragging' : ''}`}>
      <header className="topbar">
        <h1 className="topbar__logo">MULTIPLY</h1>
        <span className="topbar__turn">
          ターン {state.turn} / {TOTAL_TURNS}
        </span>
        <span className="topbar__current">
          {playing ? `${PLAYER_LABELS[state.current]} の手番` : '決着'}
          {cpuTurn && <span className="topbar__thinking">思考中…</span>}
        </span>
        <label className="topbar__opponent">
          対戦相手
          <select
            value={opponent}
            onChange={(e) => changeOpponent(e.target.value as Opponent)}
          >
            <option value="human">人間（同じ端末で2人）</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABELS[d]}
              </option>
            ))}
          </select>
        </label>
        <label className="topbar__fx">
          <input type="checkbox" checked={fxOn} onChange={(e) => toggleFx(e.target.checked)} />
          演出
        </label>
        <div className="topbar__actions">
          <button type="button" onClick={undo} disabled={history.length <= 1}>
            1手戻す
          </button>
          <button type="button" onClick={() => restart(randomSeed())}>
            新規ゲーム
          </button>
        </div>
      </header>

      {/* 選択ガイドと決着表示は同じ .picker の枠を共有する。別々のパネルにすると
          決着した瞬間にその高さぶん盤面が下へずれ、FLIP がそれを移動として拾う */}
      {playing ? (
        <TargetPicker
          state={state}
          selection={selection}
          onBack={() => setSelection(backSelection(selection))}
          onReset={() => setSelection(START)}
        />
      ) : (
        <Result state={state} onRestart={() => restart(randomSeed())} />
      )}

      <Hand
        state={state}
        player={1}
        fx={handFx(1)}
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
        effect={boardFx}
        onSelectZone={(zone) => pick({ zone })}
        onSelectMoveTo={(moveTo) => pick({ moveTo })}
        onSelectTarget={(targetUid) => pick({ targetUid })}
        onHover={handleHover}
      />

      <Hand
        state={state}
        player={0}
        fx={handFx(0)}
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

      <EffectLayer
        event={playback.event}
        showCutIn={playback.phase === 'cutin'}
        ghostLayerRef={ghostLayerRef}
        onSkip={skipFx}
      />
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
