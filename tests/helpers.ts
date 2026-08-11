// テスト用の盤面組み立てヘルパ。vite.config.ts の include は tests/**/*.test.ts なので
// このファイル自体はテストとして実行されない。
import { playTurn } from '../src/core/apply.ts'
import { nextInt, seedFrom } from '../src/core/rng.ts'
import { createGame } from '../src/core/setup.ts'
import { onEnter } from '../src/core/zone.ts'
import type {
  CardId,
  CardInstance,
  GameState,
  PlayerId,
  ZoneKey,
  ZoneState,
} from '../src/core/types.ts'
import { ALL_ZONES } from '../src/core/types.ts'

/** 実カードの uid（0..29）と衝突しない採番を始める位置 */
const TEST_UID_BASE = 1000

let nextUid = TEST_UID_BASE

export function makeCard(defId: CardId): CardInstance {
  return { uid: nextUid++, defId }
}

export function emptyZone(): ZoneState {
  return { cards: [], lockThreshold: null }
}

/** onEnter を通してカードを積むので lockThreshold も実戦どおりに設定される */
export function zoneWith(...ids: CardId[]): ZoneState {
  return ids.reduce<ZoneState>((zone, id) => onEnter(zone, makeCard(id)), emptyZone())
}

/**
 * ゾーン内容をカードIDの配列で宣言的に指定して GameState を作る。
 * 山札の枚数制限には縛られないので、同名カードを自由に並べられる。
 */
export function makeState(spec: Partial<Record<ZoneKey, CardId[]>>): GameState {
  const state = createGame(0)
  for (const key of ALL_ZONES) {
    state.zones[key] = zoneWith(...(spec[key] ?? []))
  }
  return state
}

/** ゾーンの index 番目に置かれたカードの uid */
export function uidOfNth(state: GameState, key: ZoneKey, index: number): number {
  return state.zones[key].cards[index].uid
}

/** ゾーンに置かれているカードIDを並び順で返す（アサーションを読みやすくするため） */
export function zoneIds(state: GameState, key: ZoneKey): CardId[] {
  return state.zones[key].cards.map((c) => c.defId)
}

export function handIds(state: GameState, p: PlayerId): CardId[] {
  return state.hands[p].map((c) => c.defId)
}

/** 指定プレイヤー（既定は current）の手札を差し替える */
export function withHand(state: GameState, ids: CardId[], p: PlayerId = state.current): GameState {
  const hand = ids.map(makeCard)
  return { ...state, hands: p === 0 ? [hand, state.hands[1]] : [state.hands[0], hand] }
}

/**
 * ランダム同士で決着まで打ち切る。
 * 手の選択に使う乱数は state.rng とは別系統にして、ゲーム内イベント（平原のシャッフル等）の
 * 乱数列を手の選択で汚さないようにしている。
 */
export function playoutRandom(state: GameState, seed: number): GameState {
  let s = state
  let pick = seedFrom(seed)
  let guard = 0
  while (s.phase === 'playing') {
    if (guard++ > 100) throw new Error('14ターンで終わらなかった')
    s = playTurn(s, (_, moves) => {
      const [i, next] = nextInt(pick, moves.length)
      pick = next
      return moves[i]
    })
  }
  return s
}

/** 手札・山札・捨て札・全ゾーンに散らばっているカードの uid をすべて集める */
export function allCardUids(state: GameState): number[] {
  return [
    ...state.hands[0],
    ...state.hands[1],
    ...state.deck,
    ...state.discard,
    ...ALL_ZONES.flatMap((z) => state.zones[z].cards),
  ].map((c) => c.uid)
}
