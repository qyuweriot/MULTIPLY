// 思考ルーチン（作業計画書 §10）。難易度3段。
//
// 入力は PublicView だけ。GameState を直接受け取らないので、山札の順序を
// 覗くことが型の上で不可能になっている（§1-4）。
//
// applyMove はドローしないので（Phase 3 でそう設計した）、探索中に山札から
// カードを引いてしまうことはない。
import { applyMove } from '../core/apply.ts'
import { legalMoves } from '../core/moves.ts'
import type { RngState } from '../core/rng.ts'
import { nextInt } from '../core/rng.ts'
import type { GameState, Move, PlayerId } from '../core/types.ts'
import { evaluate } from './evaluate.ts'
import type { PublicView } from './view.ts'

export type Difficulty = 'easy' | 'normal' | 'hard'

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard']

export interface Choice {
  move: Move
  rng: RngState
}

/** 同点の手が複数あるときは乱数で選ぶ（毎回同じ手ばかりになるのを防ぐ） */
function pickOne(candidates: Move[], rng: RngState): Choice {
  const [i, next] = nextInt(rng, candidates.length)
  return { move: candidates[i], rng: next }
}

/** 評価値が最大の手をすべて集める */
function bestOf(moves: Move[], valueOf: (m: Move) => number): Move[] {
  let best = -Infinity
  let winners: Move[] = []
  for (const m of moves) {
    const v = valueOf(m)
    if (v > best) {
      best = v
      winners = [m]
    } else if (v === best) {
      winners.push(m)
    }
  }
  return winners
}

/** 1手先読み：自分の手を適用した直後の評価値 */
function shallowValue(state: GameState, move: Move, me: PlayerId): number {
  return evaluate(applyMove(state, move), me)
}

/**
 * 2手先読み：自分の手 → 相手の最善応手。
 * 相手のドローは無視する（§10）。自分の手で決着したらそこで評価する。
 */
function deepValue(state: GameState, move: Move, me: PlayerId): number {
  const afterMine = applyMove(state, move)
  if (afterMine.phase !== 'playing') return evaluate(afterMine, me)

  const replies = legalMoves(afterMine)
  if (replies.length === 0) return evaluate(afterMine, me)

  // 相手は自分（me）の評価値を最小化してくると仮定する
  let worst = Infinity
  for (const reply of replies) {
    const v = evaluate(applyMove(afterMine, reply), me)
    if (v < worst) worst = v
  }
  return worst
}

export function chooseMove(view: PublicView, difficulty: Difficulty, rng: RngState): Choice {
  const { state, me } = view
  const moves = legalMoves(state)
  if (moves.length === 0) throw new Error('合法手が0件')

  if (difficulty === 'easy') return pickOne(moves, rng)

  const valueOf =
    difficulty === 'normal'
      ? (m: Move) => shallowValue(state, m, me)
      : (m: Move) => deepValue(state, m, me)

  return pickOne(bestOf(moves, valueOf), rng)
}
