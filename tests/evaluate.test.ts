// 評価関数（作業計画書 §10）。
import { describe, expect, it } from 'vitest'
import { evaluate } from '../src/ai/evaluate.ts'
import { TOTAL_TURNS } from '../src/core/setup.ts'
import type { GameState } from '../src/core/types.ts'
import { score } from '../src/core/value.ts'
import { makeState } from './helpers.ts'

/** 得点差だけを見たいときに使う、ペナルティが効かない決着後の盤面 */
const finished = (s: GameState): GameState => ({ ...s, phase: 'finished' })

describe('得点差', () => {
  it('優勢なら正、劣勢なら負', () => {
    const s = finished(
      makeState({
        p0z0: ['dangai'], // 3
        p0z1: ['dangai'], // 3 → 9点
        p1z0: ['heigen'], // 1
        p1z1: ['heigen'], // 1 → 1点
      }),
    )
    expect(score(s, 0)).toBe(9)
    expect(score(s, 1)).toBe(1)
    expect(evaluate(s, 0)).toBe(8)
    expect(evaluate(s, 1)).toBe(-8)
  })

  it('互角なら0', () => {
    const s = finished(
      makeState({ p0z0: ['dangai'], p0z1: ['dangai'], p1z0: ['dangai'], p1z1: ['dangai'] }),
    )
    expect(evaluate(s, 0)).toBe(0)
  })
})

describe('ゾーンが0のペナルティ', () => {
  it('片方のゾーンが空だと減点される', () => {
    const base = makeState({ p0z0: ['dangai'] }) // p0z1 が空 → 積0
    const s: GameState = { ...base, turn: 7 }
    // 得点差は 0-0=0。ペナルティだけが残る
    expect(evaluate(s, 0)).toBeLessThan(0)
  })

  it('終盤ほど減点が大きい（turn による重み）', () => {
    const base = makeState({ p0z0: ['dangai'] })
    const early = evaluate({ ...base, turn: 2 }, 0)
    const late = evaluate({ ...base, turn: 13 }, 0)
    expect(late).toBeLessThan(early)
  })

  it('両ゾーンが0なら2回ぶん減点される', () => {
    const one = evaluate({ ...makeState({ p0z0: ['dangai'] }), turn: TOTAL_TURNS }, 0)
    const both = evaluate({ ...makeState({}), turn: TOTAL_TURNS }, 0)
    // 空ゾーン2つ（-20×2）と、片方3・片方0（-20 かつ 不均衡 -1.5）
    expect(both).toBeLessThan(one)
  })

  it('決着後はペナルティが効かない（得点差だけになる）', () => {
    const base = makeState({ p0z0: ['dangai'] })
    expect(evaluate(finished({ ...base, turn: TOTAL_TURNS }), 0)).toBe(0)
  })
})

describe('積の均衡', () => {
  it('合計が同じでも、均衡しているほうが高く評価される', () => {
    // 均衡：3 × 3 = 9 ／ 偏り：6 × 0 = 0
    const balanced: GameState = { ...makeState({ p0z0: ['dangai'], p0z1: ['dangai'] }), turn: 7 }
    const skewed: GameState = {
      ...makeState({ p0z0: ['dangai', 'dangai', 'kagero'] }), // 陽炎で断崖が0にならず 3+3+3=9
      turn: 7,
    }
    expect(evaluate(balanced, 0)).toBeGreaterThan(evaluate(skewed, 0))
  })

  it('偏りが大きいほど減点される', () => {
    const near: GameState = { ...makeState({ p0z0: ['dangai'], p0z1: ['heigen', 'hanmo'] }), turn: 7 }
    const far: GameState = { ...makeState({ p0z0: ['kagero', 'dangai'], p0z1: ['heigen'] }), turn: 7 }
    // near: 3 と 2（差1、積6） / far: 6 と 1（差5、積6）
    expect(evaluate(near, 0)).toBeGreaterThan(evaluate(far, 0))
  })
})

describe('視点', () => {
  it('me を入れ替えると符号が反転する（ペナルティを除けば対称）', () => {
    const s = finished(
      makeState({ p0z0: ['dangai'], p0z1: ['dangai'], p1z0: ['heigen'], p1z1: ['heigen'] }),
    )
    expect(evaluate(s, 0)).toBe(-evaluate(s, 1))
  })

  it('state を変更しない', () => {
    const s = makeState({ p0z0: ['dangai'], p0z1: ['heigen'] })
    const before = JSON.stringify(s)
    evaluate(s, 0)
    expect(JSON.stringify(s)).toBe(before)
  })
})
