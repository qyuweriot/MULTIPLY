// 得点・勝敗判定。得点そのものの計算は value.ts の score() を使う。
import type { GameState, PlayerId } from './types.ts'
import { score } from './value.ts'

export interface GameResult {
  /** [プレイヤー0の得点, プレイヤー1の得点] */
  scores: [number, number]
  /** null = 引き分け */
  winner: PlayerId | null
}

export function isFinished(state: GameState): boolean {
  return state.phase === 'finished'
}

export function result(state: GameState): GameResult {
  const scores: [number, number] = [score(state, 0), score(state, 1)]
  const winner: PlayerId | null = scores[0] > scores[1] ? 0 : scores[1] > scores[0] ? 1 : null
  return { scores, winner }
}
