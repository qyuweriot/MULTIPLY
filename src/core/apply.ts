// 状態遷移。applyMove は非破壊で、つねに新しい GameState を返す（作業計画書 §1-1・§7）。
import { legalMoves } from './moves.ts'
import { TOTAL_TURNS } from './setup.ts'
import type { CardInstance, GameState, LogEntry, Move, ZoneKey } from './types.ts'
import { opponentOf } from './types.ts'
import { isFull, onEnter } from './zone.ts'

export type Chooser = (state: GameState, moves: Move[]) => Move

function withHand(state: GameState, hand: CardInstance[]): [CardInstance[], CardInstance[]] {
  return state.current === 0 ? [hand, state.hands[1]] : [state.hands[0], hand]
}

/**
 * §7 手順2：山札トップを1枚引いて current の手札に加える。
 *
 * applyMove とは意図的に分離してある。Phase 6 の CPU は applyMove を繰り返して先読みするが、
 * そこでドローが起きると山札の中身を覗くことになる（§1-4「CPUに山札の中身を見せない」）。
 */
export function beginTurn(state: GameState): GameState {
  if (state.phase !== 'playing') return state
  // 平原が手札を山札に戻すので通常は枯渇しないが、防御的に何もしない
  if (state.deck.length === 0) return state

  const [top, ...rest] = state.deck
  return {
    ...state,
    deck: rest,
    hands: withHand(state, [...state.hands[state.current], top]),
  }
}

/** §7 手順6-9：設置 → 設置時効果 → ターン進行 → 終了判定 */
export function applyMove(state: GameState, move: Move): GameState {
  if (state.phase !== 'playing') {
    throw new Error('ゲームはすでに終了している')
  }

  const player = state.current
  const hand = state.hands[player]
  const index = hand.findIndex((c) => c.uid === move.cardUid)
  if (index === -1) {
    throw new Error(`手札に uid=${move.cardUid} のカードがない`)
  }
  const card = hand[index]
  const nextHand = [...hand.slice(0, index), ...hand.slice(index + 1)]

  // 繁茂の強制が実際に効いているか（強制先が満杯なら不発＝自由に置ける）
  const forceApplies = state.forcedZone !== null && !isFull(state.zones[state.forcedZone])

  let zones = state.zones
  let discard = state.discard

  if (move.discardOnly) {
    // 安全弁：設置せず手札を1枚捨ててターンを終える
    discard = [...discard, card]
  } else {
    if (isFull(state.zones[move.zone])) {
      throw new Error(`${move.zone} は満杯なので設置できない`)
    }
    if (forceApplies && move.zone !== state.forcedZone) {
      throw new Error(`繁茂により ${state.forcedZone} に置かなければならない`)
    }
    zones = { ...zones, [move.zone]: onEnter(zones[move.zone], card) }
  }

  // ── 設置時効果（Phase 4 でここを埋める）──────────────────────────────
  // 平原・繁茂・渦潮・疾風・刺創の解決はこの1箇所に集約する。
  // 渦潮で移動したカードの設置時効果は再発動しない（§14-7）。
  // 現時点では move.targetUid / move.moveTo はログに残すだけで効果を持たない。

  // 次ターンの制約は「今置いたカード」だけから決める。古い値は決して引き継がないので、
  // 「繁茂を置いたターンに自分の制約を自分で消す」バグ（§14-1）は構造的に起こり得ない。
  // Phase 4 でここが「置いたカードが繁茂なら設置先ゾーン」に変わる。
  const forcedZone: ZoneKey | null = null

  const entry: LogEntry = {
    turn: state.turn,
    player,
    cardUid: card.uid,
    cardId: card.defId,
    zone: move.zone,
    ...(move.targetUid !== undefined ? { targetUid: move.targetUid } : {}),
    ...(move.moveTo !== undefined ? { moveTo: move.moveTo } : {}),
    ...(move.discardOnly ? { discardOnly: true } : {}),
    ...(forceApplies && !move.discardOnly ? { forced: true } : {}),
  }

  const finished = state.turn >= TOTAL_TURNS

  return {
    ...state,
    zones,
    hands: withHand(state, nextHand),
    discard,
    // turn は §4 の「1〜14」を守り、最終ターンでは据え置いて phase で終了を表す
    turn: finished ? state.turn : state.turn + 1,
    current: opponentOf(player),
    forcedZone,
    log: [...state.log, entry],
    phase: finished ? 'finished' : 'playing',
  }
}

/** ドロー → 合法手の列挙 → 選択 → 適用 をまとめた1ターン分の進行 */
export function playTurn(state: GameState, choose: Chooser): GameState {
  if (state.phase !== 'playing') return state
  const drawn = beginTurn(state)
  const moves = legalMoves(drawn)
  if (moves.length === 0) {
    throw new Error('合法手が0件（legalMoves の安全弁が働いていない）')
  }
  return applyMove(drawn, choose(drawn, moves))
}
