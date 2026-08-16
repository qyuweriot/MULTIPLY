// 合法手の列挙。対象選択まで含めて完全に列挙する（作業計画書 §8）。
import type { GameState, Move, ZoneKey } from './types.ts'
import { ALL_ZONES } from './types.ts'
import { canPlace } from './zone.ts'

/**
 * 現在のプレイヤーが取れる手をすべて列挙する。
 *
 * force は「今ターンの設置制約」（繁茂）。省略時は state.forcedZone を使う。
 * 強制先にそのカードを置けないなら強制は不発になり、自由に置ける（正典の繁茂【裁定】）。
 */
export function legalMoves(state: GameState, force: ZoneKey | null = state.forcedZone): Move[] {
  const hand = state.hands[state.current]

  const moves: Move[] = []
  for (const card of hand) {
    // 氷山があるゾーンは本来の数値が2のカードしか受け付けないので、候補は手札1枚ごとに変わる
    const open = ALL_ZONES.filter((z) => canPlace(state.zones[z], card))
    const zones = force !== null && canPlace(state.zones[force], card) ? [force] : open

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
        // 移動先に置けるかは「移動するカード」で決まるので、対象ごとに出し直す
        let any = false
        for (const t of others) {
          for (const d of ALL_ZONES) {
            if (d === zone || !canPlace(state.zones[d], t)) continue
            moves.push({ cardUid: card.uid, zone, targetUid: t.uid, moveTo: d })
            any = true
          }
        }
        if (!any) moves.push({ cardUid: card.uid, zone }) // 不発
      } else {
        moves.push({ cardUid: card.uid, zone })
      }
    }
  }

  // 安全弁：ルール上ここには到達しない（氷山は3枚なので必ず1ゾーンは自由）が、
  // カード追加時やバグ時にゲームがフリーズしないための最終防衛ライン。
  if (moves.length === 0) {
    return hand.map((c) => ({ cardUid: c.uid, zone: 'p0z0' as ZoneKey, discardOnly: true }))
  }
  return moves
}
