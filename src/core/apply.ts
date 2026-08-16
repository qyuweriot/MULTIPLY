// 状態遷移と設置時効果。applyMove は非破壊で、つねに新しい GameState を返す
// （作業計画書 §1-1・§7）。
import { legalMoves } from './moves.ts'
import { shuffle } from './rng.ts'
import { TOTAL_TURNS } from './setup.ts'
import type { CardInstance, GameState, LogEntry, Move, PlayerId, ZoneKey } from './types.ts'
import { ALL_ZONES, opponentOf } from './types.ts'
import { canPlace, onEnter, onLeave } from './zone.ts'

export type Chooser = (state: GameState, moves: Move[]) => Move

/** 平原が引く枚数（正典：固定2枚） */
const HEIGEN_DRAW = 2

function setHand(state: GameState, p: PlayerId, hand: CardInstance[]): [CardInstance[], CardInstance[]] {
  return p === 0 ? [hand, state.hands[1]] : [state.hands[0], hand]
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
    hands: setHand(state, state.current, [...state.hands[state.current], top]),
  }
}

/** 渦潮の移動先候補（設置前の盤面を基準に、移動するカードで判定する） */
function uzushioDests(state: GameState, zone: ZoneKey, target: CardInstance): ZoneKey[] {
  return ALL_ZONES.filter((z) => z !== zone && canPlace(state.zones[z], target))
}

/**
 * 対象指定の妥当性を設置前の盤面で検証する。legalMoves を呼び直しての照合はしない
 * （Phase 6 の探索ホットパスで二重計算になるため）。同じ条件式をここに書く。
 */
function validateTargets(state: GameState, move: Move, card: CardInstance): void {
  const others = state.zones[move.zone].cards

  if (card.defId === 'shiso') {
    if (others.length === 0) {
      if (move.targetUid !== undefined) throw new Error('刺創：対象がいないのに対象が指定されている')
      return
    }
    if (move.targetUid === undefined) throw new Error('刺創：対象を指定する必要がある')
    if (!others.some((c) => c.uid === move.targetUid)) {
      throw new Error(`刺創：uid=${move.targetUid} は ${move.zone} にない`)
    }
    return
  }

  if (card.defId === 'uzushio') {
    const movable = others.some((t) => uzushioDests(state, move.zone, t).length > 0)
    if (!movable) {
      if (move.targetUid !== undefined || move.moveTo !== undefined) {
        throw new Error('渦潮：不発のはずなのに対象または移動先が指定されている')
      }
      return
    }
    if (move.targetUid === undefined || move.moveTo === undefined) {
      throw new Error('渦潮：対象と移動先の両方を指定する必要がある')
    }
    const target = others.find((c) => c.uid === move.targetUid)
    if (target === undefined) {
      throw new Error(`渦潮：uid=${move.targetUid} は ${move.zone} にない`)
    }
    if (!uzushioDests(state, move.zone, target).includes(move.moveTo)) {
      throw new Error(`渦潮：${move.moveTo} は移動先に選べない`)
    }
  }
}

/**
 * §7 手順7：設置時効果の解決。
 *
 * 引数の state は「カードを手札から取り除き、ゾーンに設置し終えた直後」の中間状態で、
 * current はまだ使用者のまま。氷山・陽炎・月光・双翼・断崖・足枷・洞穴は常在効果なので
 * ここでは何もしない（zoneTotal が毎回計算する）。
 */
function resolveOnPlace(
  state: GameState,
  move: Move,
  card: CardInstance,
): { state: GameState; fizzled: boolean } {
  const player = state.current

  switch (card.defId) {
    // 手札をすべて山札に戻してシャッフルし、その後2枚引く
    case 'heigen': {
      const [deck, rng] = shuffle([...state.deck, ...state.hands[player]], state.rng)
      const drawn = deck.slice(0, Math.min(HEIGEN_DRAW, deck.length))
      return {
        state: {
          ...state,
          deck: deck.slice(drawn.length),
          hands: setHand(state, player, drawn),
          rng,
        },
        fizzled: false,
      }
    }

    // 相手と手札をすべて交換する
    case 'shippu':
      return { state: { ...state, hands: [state.hands[1], state.hands[0]] }, fizzled: false }

    // このゾーンにあるカードを1枚選び、別のゾーンへ移動させる
    case 'uzushio': {
      if (move.targetUid === undefined || move.moveTo === undefined) {
        return { state, fizzled: true } // 対象なし／移動先なしで不発
      }
      const from = move.zone
      const to = move.moveTo
      const target = state.zones[from].cards.find((c) => c.uid === move.targetUid)
      if (target === undefined) return { state, fizzled: true }

      // onLeave → onEnter。氷山ならロックが移動元から移動先へ移る。
      // 移動したカードの設置時効果は再発動しない（§14-7）。
      const left = onLeave(state.zones[from], target)
      return {
        state: {
          ...state,
          zones: { ...state.zones, [from]: left, [to]: onEnter(state.zones[to], target) },
        },
        fizzled: false,
      }
    }

    // このゾーンにあるカードを1枚選び、捨て札にする
    case 'shiso': {
      if (move.targetUid === undefined) return { state, fizzled: true }
      const target = state.zones[move.zone].cards.find((c) => c.uid === move.targetUid)
      if (target === undefined) return { state, fizzled: true }

      return {
        state: {
          ...state,
          zones: { ...state.zones, [move.zone]: onLeave(state.zones[move.zone], target) },
          // 捨て札はゲームから除外され、山札には戻らない
          discard: [...state.discard, target],
        },
        fizzled: false,
      }
    }

    // 繁茂の forcedZone は applyMove の後段でまとめて決める
    default:
      return { state, fizzled: false }
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

  // 繁茂の強制が実際に効いているか
  // （強制先にそのカードを置けないなら不発＝自由に置ける）
  const forceApplies =
    state.forcedZone !== null && canPlace(state.zones[state.forcedZone], card)

  // ── 設置 ──────────────────────────────────────────────────────────
  let placed: GameState
  if (move.discardOnly) {
    // 安全弁：設置せず手札を1枚捨ててターンを終える
    placed = { ...state, hands: setHand(state, player, nextHand), discard: [...state.discard, card] }
  } else {
    if (!canPlace(state.zones[move.zone], card)) {
      throw new Error(`${move.zone} は氷山により ${card.defId} を設置できない`)
    }
    if (forceApplies && move.zone !== state.forcedZone) {
      throw new Error(`繁茂により ${state.forcedZone} に置かなければならない`)
    }
    validateTargets(state, move, card)

    placed = {
      ...state,
      hands: setHand(state, player, nextHand),
      zones: { ...state.zones, [move.zone]: onEnter(state.zones[move.zone], card) },
    }
  }

  // ── 設置時効果 ────────────────────────────────────────────────────
  const { state: resolved, fizzled } = move.discardOnly
    ? { state: placed, fizzled: false }
    : resolveOnPlace(placed, move, card)

  // 次ターンの制約は「今置いたカード」だけから決める。古い値は決して引き継がないので、
  // 「繁茂を置いたターンに自分の制約を自分で消す」バグ（§14-1）は構造的に起こり得ない。
  const forcedZone: ZoneKey | null = !move.discardOnly && card.defId === 'hanmo' ? move.zone : null

  const entry: LogEntry = {
    turn: state.turn,
    player,
    cardUid: card.uid,
    cardId: card.defId,
    zone: move.zone,
    ...(move.targetUid !== undefined ? { targetUid: move.targetUid } : {}),
    ...(move.moveTo !== undefined ? { moveTo: move.moveTo } : {}),
    ...(move.discardOnly ? { discardOnly: true } : {}),
    ...(fizzled ? { fizzled: true } : {}),
    ...(forceApplies && !move.discardOnly ? { forced: true } : {}),
  }

  const finished = state.turn >= TOTAL_TURNS

  return {
    ...resolved,
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
