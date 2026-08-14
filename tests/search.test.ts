// 思考ルーチン（作業計画書 §10）。完了条件は「hard が easy に勝率80%以上」。
import { describe, expect, it } from 'vitest'
import { evaluate } from '../src/ai/evaluate.ts'
import { chooseMove, DIFFICULTIES } from '../src/ai/search.ts'
import type { Difficulty } from '../src/ai/search.ts'
import { visibleTo } from '../src/ai/view.ts'
import { applyMove, beginTurn } from '../src/core/apply.ts'
import { legalMoves } from '../src/core/moves.ts'
import { seedFrom } from '../src/core/rng.ts'
import { createGame, TOTAL_TURNS } from '../src/core/setup.ts'
import { playCpuGame, winRate } from './helpers.ts'

describe('合法性と決定性', () => {
  it('全難易度で、返す手はつねに legalMoves に含まれる', () => {
    for (const d of DIFFICULTIES) {
      for (let seed = 0; seed < 12; seed++) {
        let s = beginTurn(createGame(seed))
        let rng = seedFrom(seed)
        while (s.phase === 'playing') {
          const moves = legalMoves(s)
          const picked = chooseMove(visibleTo(s, s.current), d, rng)
          expect(moves, `${d} seed=${seed} turn=${s.turn}`).toContainEqual(picked.move)
          rng = picked.rng
          const after = applyMove(s, picked.move)
          s = after.phase === 'playing' ? beginTurn(after) : after
        }
      }
    }
  })

  it('同じビュー・同じ乱数なら同じ手を返す', () => {
    const s = beginTurn(createGame(21))
    const view = visibleTo(s, s.current)
    for (const d of DIFFICULTIES) {
      const a = chooseMove(view, d, seedFrom(5))
      const b = chooseMove(view, d, seedFrom(5))
      expect(a).toEqual(b)
    }
  })

  it('全難易度で14ターン完走する', () => {
    for (const d of DIFFICULTIES) {
      const end = playCpuGame(3, [d, d])
      expect(end.phase, d).toBe('finished')
      expect(end.log, d).toHaveLength(TOTAL_TURNS)
    }
  })

  it('CPU は山札の順序を参照できない（PublicView だけを受け取る）', () => {
    // 山札を並べ替えても、同じ乱数なら同じ手になる
    const s = beginTurn(createGame(33))
    const shuffled = { ...s, deck: [...s.deck].reverse() }
    for (const d of DIFFICULTIES) {
      const a = chooseMove(visibleTo(s, s.current), d, seedFrom(1))
      const b = chooseMove(visibleTo(shuffled, shuffled.current), d, seedFrom(1))
      expect(a.move, d).toEqual(b.move)
    }
  })
})

describe('normal：1手先読み', () => {
  it('適用直後の評価値が最大の手を選ぶ', () => {
    for (let seed = 0; seed < 8; seed++) {
      const s = beginTurn(createGame(seed))
      const me = s.current
      const { move } = chooseMove(visibleTo(s, me), 'normal', seedFrom(seed))

      const chosen = evaluate(applyMove(s, move), me)
      const best = Math.max(...legalMoves(s).map((m) => evaluate(applyMove(s, m), me)))
      expect(chosen, `seed=${seed}`).toBe(best)
    }
  })
})

describe('hard：2手先読み', () => {
  it('相手の応手まで含めた最悪値が最大の手を選ぶ', () => {
    const s = beginTurn(createGame(17))
    const me = s.current
    const { move } = chooseMove(visibleTo(s, me), 'hard', seedFrom(17))

    /** その手を指したあと、相手に最善を返されたときの評価値 */
    const worstAfter = (m: (typeof moves)[number]) => {
      const after = applyMove(s, m)
      if (after.phase !== 'playing') return evaluate(after, me)
      return Math.min(...legalMoves(after).map((r) => evaluate(applyMove(after, r), me)))
    }

    const moves = legalMoves(s)
    const chosen = worstAfter(move)
    const best = Math.max(...moves.map(worstAfter))
    expect(chosen).toBe(best)
  })

  it('normal とは違う手を選ぶ場面がある（先読みが効いている）', () => {
    let differed = 0
    for (let seed = 0; seed < 20; seed++) {
      const s = beginTurn(createGame(seed))
      const view = visibleTo(s, s.current)
      const n = chooseMove(view, 'normal', seedFrom(seed)).move
      const h = chooseMove(view, 'hard', seedFrom(seed)).move
      if (JSON.stringify(n) !== JSON.stringify(h)) differed++
    }
    expect(differed).toBeGreaterThan(0)
  })
})

describe('★完了条件：難易度の強さの順序', () => {
  // 先後を入れ替えながら戦わせるので、先攻有利の偏りは打ち消される。
  // 固定シードなので結果は決定的でフレークしない。
  const rate = (pair: [Difficulty, Difficulty], games: number) => winRate(pair, games)

  it('hard が easy に勝率80%以上（§13 の完了条件）', () => {
    const r = rate(['hard', 'easy'], 30)
    expect(
      r.rate,
      `hard ${r.wins}勝 ${r.losses}敗 ${r.draws}分（勝率 ${(r.rate * 100).toFixed(1)}%）`,
    ).toBeGreaterThanOrEqual(0.8)
  })

  it('normal が easy に有意に勝ち越す', () => {
    const r = rate(['normal', 'easy'], 20)
    expect(r.rate, `normal ${r.wins}勝 ${r.losses}敗 ${r.draws}分`).toBeGreaterThan(0.6)
  })

  it('hard が normal に負け越さない', () => {
    const r = rate(['hard', 'normal'], 20)
    expect(r.wins, `hard ${r.wins}勝 ${r.losses}敗 ${r.draws}分`).toBeGreaterThanOrEqual(r.losses)
  })
})
