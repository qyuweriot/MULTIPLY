// テスト用の盤面組み立てヘルパ。vite.config.ts の include は tests/**/*.test.ts なので
// このファイル自体はテストとして実行されない。
import { createGame } from '../src/core/setup.ts'
import { onEnter } from '../src/core/zone.ts'
import type { CardId, CardInstance, GameState, ZoneKey, ZoneState } from '../src/core/types.ts'
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
