// 合法手の列挙。対象選択まで含めて完全に列挙する（作業計画書 §8）。
import type { GameState, Move, ZoneKey } from './types.ts'
import { ALL_ZONES } from './types.ts'
import { isFull } from './zone.ts'

/**
 * 現在のプレイヤーが取れる手をすべて列挙する。
 *
 * force は「今ターンの設置制約」（繁茂）。省略時は state.forcedZone を使う。
 * 強制先が満杯なら強制は不発になり、自由に置ける（正典の繁茂【裁定】）。
 */
export function legalMoves(state: GameState, force: ZoneKey | null = state.forcedZone): Move[] {
  const hand = state.hands[state.current]
  const open = ALL_ZONES.filter((z) => !isFull(state.zones[z]))
  const zones = force !== null && !isFull(state.zones[force]) ? [force] : open

  const moves: Move[] = []
  for (const card of hand) {
    for (const zone of zones) {
      // 設置前のゾーン内容。自身は含まれないので、渦潮・刺創が自分を対象に取れない
      // という裁定が自然に満たされる。
      const others = state.zones[zone].cards

      if (card.defId === 'shiso') {
        if (others.length === 0) {
          moves.push({ cardUid: card.uid, zone }) // 不発
        } else {
          for (const t of others) moves.push({ cardUid: card.uid, zone, targetUid: t.uid })
        }
      } else if (card.defId === 'uzushio') {
        const dests = open.filter((z) => z !== zone)
        if (others.length === 0 || dests.length === 0) {
          moves.push({ cardUid: card.uid, zone }) // 不発
        } else {
          for (const t of others) {
            for (const d of dests) {
              moves.push({ cardUid: card.uid, zone, targetUid: t.uid, moveTo: d })
            }
          }
        }
      } else {
        moves.push({ cardUid: card.uid, zone })
      }
    }
  }

  // 安全弁：ルール上ここには到達しない（氷山は3枚なので必ず1ゾーン空く）が、
  // カード追加時やバグ時にゲームがフリーズしないための最終防衛ライン。
  if (moves.length === 0) {
    return hand.map((c) => ({ cardUid: c.uid, zone: 'p0z0' as ZoneKey, discardOnly: true }))
  }
  return moves
}
