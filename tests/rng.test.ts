import { describe, expect, it } from 'vitest'
import { nextInt, nextRandom, seedFrom, shuffle } from '../src/core/rng.ts'

describe('nextRandom', () => {
  it('[0, 1) に収まる', () => {
    let s = seedFrom(12345)
    for (let i = 0; i < 1000; i++) {
      const [r, next] = nextRandom(s)
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThan(1)
      s = next
    }
  })

  it('純関数：同じ状態からは同じ値と同じ次状態が返る', () => {
    const s = seedFrom(42)
    expect(nextRandom(s)).toEqual(nextRandom(s))
  })

  it('状態が進むと値が変わる', () => {
    const [a, s1] = nextRandom(seedFrom(42))
    const [b] = nextRandom(s1)
    expect(a).not.toBe(b)
  })
})

describe('nextInt', () => {
  it('0 以上 n 未満に収まる', () => {
    let s = seedFrom(7)
    for (let i = 0; i < 1000; i++) {
      const [v, next] = nextInt(s, 6)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(6)
      s = next
    }
  })

  it('n=1 では常に 0', () => {
    const [v] = nextInt(seedFrom(99), 1)
    expect(v).toBe(0)
  })

  it('n<1 では 0 を返し状態を進めない', () => {
    const s = seedFrom(99)
    expect(nextInt(s, 0)).toEqual([0, s])
  })
})

describe('shuffle', () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  it('入力配列を破壊しない', () => {
    const original = [...items]
    shuffle(items, seedFrom(1))
    expect(items).toEqual(original)
  })

  it('要素の多重集合を保存する', () => {
    const [out] = shuffle(items, seedFrom(3))
    expect(out).toHaveLength(items.length)
    expect([...out].sort((a, b) => a - b)).toEqual(items)
  })

  it('同じシードなら同じ並びになる', () => {
    expect(shuffle(items, seedFrom(2024))).toEqual(shuffle(items, seedFrom(2024)))
  })

  it('シードが違えば並びが変わる', () => {
    const [a] = shuffle(items, seedFrom(1))
    const [b] = shuffle(items, seedFrom(2))
    expect(a).not.toEqual(b)
  })

  it('空配列でも落ちない', () => {
    const s = seedFrom(5)
    expect(shuffle([], s)).toEqual([[], s])
  })
})
