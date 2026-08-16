// 山札生成・シャッフル・初期配布。
import { CARD_ORDER, CARD_DEFS } from './cards.ts'
import { seedFrom, shuffle } from './rng.ts'
import type { CardInstance, GameState, ZoneKey, ZoneState } from './types.ts'
import { ALL_ZONES } from './types.ts'

/** 各プレイヤーの初期手札。正典 §4「初期手札4枚」＝ 2人 × 2枚 */
export const INITIAL_HAND_SIZE = 2

/** 総ターン数。7ターンずつの交互進行 */
export const TOTAL_TURNS = 14

/**
 * シャッフル前の山札。uid は定義順（CARD_ORDER）に 0 から連番で振る。
 * uid の採番がシャッフルと独立しているので、同じシードなら棋譜が完全に再現される。
 */
export function buildDeck(): CardInstance[] {
  const deck: CardInstance[] = []
  for (const id of CARD_ORDER) {
    for (let i = 0; i < CARD_DEFS[id].copies; i++) {
      deck.push({ uid: deck.length, defId: id })
    }
  }
  return deck
}

function emptyZones(): Record<ZoneKey, ZoneState> {
  const zones = {} as Record<ZoneKey, ZoneState>
  for (const key of ALL_ZONES) {
    zones[key] = { cards: [] }
  }
  return zones
}

export function createGame(seed: number): GameState {
  const [deck, rng] = shuffle(buildDeck(), seedFrom(seed))

  // 山札トップから p0 → p1 の順に交互に配る
  const hands: [CardInstance[], CardInstance[]] = [[], []]
  let cursor = 0
  for (let i = 0; i < INITIAL_HAND_SIZE; i++) {
    hands[0].push(deck[cursor++])
    hands[1].push(deck[cursor++])
  }

  return {
    zones: emptyZones(),
    hands,
    deck: deck.slice(cursor),
    discard: [],
    turn: 1,
    current: 0,
    forcedZone: null,
    rng,
    log: [],
    phase: 'playing',
  }
}
