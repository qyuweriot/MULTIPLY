// 得点・勝敗判定。得点そのものの計算は value.ts の score() を使う。
import type { GameState, PlayerId } from './types.ts'
import { score } from './value.ts'

/** 得点が並んだときに勝つ側。先攻＝プレイヤー0（正典 §1 のタイブレーク） */
const TIE_WINNER: PlayerId = 0

export interface GameResult {
  /** [プレイヤー0の得点, プレイヤー1の得点] */
  scores: [number, number]
  /** 引き分けはない。同点なら先攻の勝ち */
  winner: PlayerId
  /** 得点が並んでいたか。表示と指標のために残す */
  tied: boolean
}

export function isFinished(state: GameState): boolean {
  return state.phase === 'finished'
}

export function result(state: GameState): GameResult {
  const scores: [number, number] = [score(state, 0), score(state, 1)]
  const tied = scores[0] === scores[1]
  // 引き分けを潰すのは、最後に置く後攻が構造的に有利だから（作業計画書 §13 Phase 7）
  const winner: PlayerId = tied ? TIE_WINNER : scores[0] > scores[1] ? 0 : 1
  return { scores, winner, tied }
}
