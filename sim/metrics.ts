// バランス調整用の指標集計（作業計画書 §11）。
// CLI と混ぜると検証できないので、集計は純関数としてここに切り出してある。
import { CARD_ORDER } from '../src/core/cards.ts'
import type { CardId, LogEntry, PlayerId } from '../src/core/types.ts'
import { ownerOf } from '../src/core/types.ts'

export interface GameRecord {
  scores: [number, number]
  winner: PlayerId | null
  /** ターン14の着手「直前」のリード者。最終ターン逆転率に使う */
  leaderBeforeLastMove: PlayerId | null
  log: LogEntry[]
  /** 終局時に空だったゾーン数（0〜4） */
  emptyZones: number
  /** 終局時に合計が0以下だったゾーンのうち、カードが1枚以上あったもの（＝潰された） */
  crushedZones: number
  /** 潰されたゾーンに何がいたか（診断用） */
  crushedBy: { gekko: number; ashikase: number; other: number }
}

export interface CardStat {
  id: CardId
  /** そのカードを1枚以上置いた (試合, プレイヤー) の組の数 */
  samples: number
  /** 上記のうち勝った割合 */
  winRate: number
  /** 設置された延べ枚数 */
  placements: number
  /** 自分のゾーンに置かれた割合 */
  ownRate: number
}

export interface Metrics {
  games: number
  /** 先攻（プレイヤー0）の勝率 */
  firstPlayerWinRate: number
  drawRate: number
  /** どちらかの最終得点が0だった試合の割合 */
  zeroScoreRate: number
  averageScore: number
  maxScore: number
  /** 最終手で勝敗が決した割合（直前のリード者と最終勝者が違う） */
  lastTurnSwingRate: number
  /** そのうち、明確にリードが入れ替わった割合（両者とも非null） */
  clearReversalRate: number
  cards: CardStat[]
  /** 診断用 */
  avgEmptyZones: number
  avgCrushedZones: number
  crushedBy: { gekko: number; ashikase: number; other: number }
  fizzleRate: number
  discardOnlyRate: number
  /** 最終手で勝敗が動かなかった試合に限った先攻勝率 */
  firstPlayerWinRateStable: number
  /** 最終手で勝敗が動いた試合のうち、最後に置いた側（後攻）が勝った割合 */
  lastMoverWinsSwing: number
}

const empty: Metrics = {
  games: 0,
  firstPlayerWinRate: 0,
  drawRate: 0,
  zeroScoreRate: 0,
  averageScore: 0,
  maxScore: 0,
  lastTurnSwingRate: 0,
  clearReversalRate: 0,
  cards: [],
  avgEmptyZones: 0,
  avgCrushedZones: 0,
  crushedBy: { gekko: 0, ashikase: 0, other: 0 },
  fizzleRate: 0,
  discardOnlyRate: 0,
  firstPlayerWinRateStable: 0,
  lastMoverWinsSwing: 0,
}

export function summarize(records: readonly GameRecord[]): Metrics {
  if (records.length === 0) return empty

  const n = records.length
  let firstWins = 0
  let draws = 0
  let zeroScore = 0
  let scoreSum = 0
  let maxScore = 0
  let swings = 0
  let reversals = 0
  let emptyZones = 0
  let crushedZones = 0
  const crushedBy = { gekko: 0, ashikase: 0, other: 0 }
  let stableGames = 0
  let stableFirstWins = 0
  let swingLastMoverWins = 0
  let moves = 0
  let fizzles = 0
  let discardOnly = 0

  // カード別：置いた (試合, プレイヤー) の組ごとに勝敗を数える
  const samples = new Map<CardId, number>()
  const wins = new Map<CardId, number>()
  const placements = new Map<CardId, number>()
  const ownPlacements = new Map<CardId, number>()

  for (const r of records) {
    if (r.winner === 0) firstWins++
    if (r.winner === null) draws++
    if (r.scores[0] === 0 || r.scores[1] === 0) zeroScore++
    scoreSum += r.scores[0] + r.scores[1]
    maxScore = Math.max(maxScore, r.scores[0], r.scores[1])

    if (r.leaderBeforeLastMove !== r.winner) {
      swings++
      // 最後に置くのは後攻（プレイヤー1）
      if (r.winner === 1) swingLastMoverWins++
    } else {
      stableGames++
      if (r.winner === 0) stableFirstWins++
    }
    if (
      r.leaderBeforeLastMove !== null &&
      r.winner !== null &&
      r.leaderBeforeLastMove !== r.winner
    ) {
      reversals++
    }

    emptyZones += r.emptyZones
    crushedZones += r.crushedZones
    crushedBy.gekko += r.crushedBy.gekko
    crushedBy.ashikase += r.crushedBy.ashikase
    crushedBy.other += r.crushedBy.other

    const used: [Set<CardId>, Set<CardId>] = [new Set(), new Set()]
    for (const e of r.log) {
      moves++
      if (e.fizzled) fizzles++
      if (e.discardOnly) {
        discardOnly++
        continue
      }
      used[e.player].add(e.cardId)
      placements.set(e.cardId, (placements.get(e.cardId) ?? 0) + 1)
      if (ownerOf(e.zone) === e.player) {
        ownPlacements.set(e.cardId, (ownPlacements.get(e.cardId) ?? 0) + 1)
      }
    }

    for (const p of [0, 1] as PlayerId[]) {
      for (const id of used[p]) {
        samples.set(id, (samples.get(id) ?? 0) + 1)
        if (r.winner === p) wins.set(id, (wins.get(id) ?? 0) + 1)
      }
    }
  }

  const cards: CardStat[] = CARD_ORDER.map((id) => {
    const s = samples.get(id) ?? 0
    const pl = placements.get(id) ?? 0
    return {
      id,
      samples: s,
      winRate: s === 0 ? 0 : (wins.get(id) ?? 0) / s,
      placements: pl,
      ownRate: pl === 0 ? 0 : (ownPlacements.get(id) ?? 0) / pl,
    }
  })

  return {
    games: n,
    firstPlayerWinRate: firstWins / n,
    drawRate: draws / n,
    zeroScoreRate: zeroScore / n,
    averageScore: scoreSum / (n * 2),
    maxScore,
    lastTurnSwingRate: swings / n,
    clearReversalRate: reversals / n,
    cards,
    avgEmptyZones: emptyZones / n,
    avgCrushedZones: crushedZones / n,
    crushedBy,
    fizzleRate: moves === 0 ? 0 : fizzles / moves,
    discardOnlyRate: moves === 0 ? 0 : discardOnly / moves,
    firstPlayerWinRateStable: stableGames === 0 ? 0 : stableFirstWins / stableGames,
    lastMoverWinsSwing: swings === 0 ? 0 : swingLastMoverWins / swings,
  }
}
