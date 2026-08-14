// 評価関数（作業計画書 §10）。値が大きいほど me にとって良い盤面。
import { TOTAL_TURNS } from '../core/setup.ts'
import type { GameState, PlayerId } from '../core/types.ts'
import { opponentOf, zonesOf } from '../core/types.ts'
import { score, zoneTotal } from '../core/value.ts'

/** 片方のゾーンが0だと総得点が0になるので、その危険を重く見る */
const ZERO_ZONE_PENALTY = 20
/** 積は均衡しているほうが大きい（6×6=36 > 10×2=20） */
const IMBALANCE_WEIGHT = 0.5

export function evaluate(state: GameState, me: PlayerId): number {
  let v = score(state, me) - score(state, opponentOf(me))

  if (state.phase !== 'finished') {
    // 終盤ほど強く警戒する
    const w = state.turn / TOTAL_TURNS
    const [z0, z1] = zonesOf(me)
    const a = zoneTotal(state, z0)
    const b = zoneTotal(state, z1)

    if (a <= 0) v -= ZERO_ZONE_PENALTY * w
    if (b <= 0) v -= ZERO_ZONE_PENALTY * w
    v -= Math.abs(a - b) * IMBALANCE_WEIGHT
  }

  return v
}
