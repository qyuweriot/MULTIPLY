// シミュレータの指標集計（作業計画書 §11）。
import { describe, expect, it } from 'vitest'
import type { GameRecord } from '../sim/metrics.ts'
import { leaderOf, summarize } from '../sim/metrics.ts'
import type { CardId, LogEntry, PlayerId, ZoneKey } from '../src/core/types.ts'
import { makeState } from './helpers.ts'

let turn = 0
function entry(player: PlayerId, cardId: CardId, zone: ZoneKey, extra: Partial<LogEntry> = {}): LogEntry {
  return { turn: ++turn, player, cardId, cardUid: turn, zone, ...extra }
}

function record(over: Partial<GameRecord> = {}): GameRecord {
  return {
    scores: [10, 5],
    winner: 0,
    leaderBeforeLastMove: 0,
    log: [],
    emptyZones: 0,
    crushedZones: 0,
    crushedBy: { gekko: 0, ashikase: 0, other: 0 },
    ...over,
  }
}

describe('勝敗まわり', () => {
  it('先攻勝率を数える', () => {
    const m = summarize([
      record({ winner: 0 }),
      record({ winner: 0 }),
      record({ winner: 1 }),
      record({ winner: 1 }),
    ])
    expect(m.games).toBe(4)
    expect(m.firstPlayerWinRate).toBe(0.5)
  })

  // 同点は先攻の勝ちになるので、勝敗からは数えられない。得点そのものを見る
  it('同点率は得点が並んだ試合を数える（勝敗ではなく得点から）', () => {
    const m = summarize([
      record({ scores: [12, 12], winner: 0 }),
      record({ scores: [12, 12], winner: 0 }),
      record({ scores: [12, 5], winner: 0 }),
      record({ scores: [5, 12], winner: 1 }),
    ])
    expect(m.tieRate).toBe(0.5)
  })

  it('0点決着率はどちらかの得点が0なら数える', () => {
    const m = summarize([
      record({ scores: [0, 12] }),
      record({ scores: [12, 0] }),
      record({ scores: [0, 0] }),
      record({ scores: [8, 9] }),
    ])
    expect(m.zeroScoreRate).toBe(0.75)
  })

  it('平均スコアは両者ぶんを平均する', () => {
    const m = summarize([record({ scores: [10, 20] }), record({ scores: [30, 40] })])
    expect(m.averageScore).toBe(25)
    expect(m.maxScore).toBe(40)
  })
})

describe('leaderOf：いま決着したとしたら勝つ側', () => {
  it('得点が上の側', () => {
    // p0 は 3×3=9、p1 は 1×1=1
    const s = makeState({ p0z0: ['dangai'], p0z1: ['dangai'], p1z0: ['heigen'], p1z1: ['heigen'] })
    expect(leaderOf(s)).toBe(0)
    expect(leaderOf(makeState({ p0z0: ['heigen'], p0z1: ['heigen'], p1z0: ['dangai'], p1z1: ['dangai'] }))).toBe(1)
  })

  // ここを「並び＝リードなし」にすると、最終ターン逆転率が実際のルールとズレる
  it('並んでいたら先攻。同点は先攻の勝ちだから', () => {
    const s = makeState({ p0z0: ['heigen'], p0z1: ['heigen'], p1z0: ['heigen'], p1z1: ['heigen'] })
    expect(leaderOf(s)).toBe(0)
    expect(leaderOf(makeState({}))).toBe(0) // 0 対 0
  })
})

describe('最終ターン逆転率', () => {
  it('直前のリード者がそのまま勝てば逆転ではない', () => {
    expect(summarize([record({ leaderBeforeLastMove: 0, winner: 0 })]).lastTurnSwingRate).toBe(0)
    expect(summarize([record({ leaderBeforeLastMove: 1, winner: 1 })]).lastTurnSwingRate).toBe(0)
  })

  it('リードが入れ替わったら逆転', () => {
    expect(summarize([record({ leaderBeforeLastMove: 0, winner: 1 })]).lastTurnSwingRate).toBe(1)
    expect(summarize([record({ leaderBeforeLastMove: 1, winner: 0 })]).lastTurnSwingRate).toBe(1)
  })

  // 同点は先攻の勝ちなので、並んでいる状態も「先攻がリード」として扱う。
  // 後攻が最終手で並びに持ち込んでも、それは逆転ではない
  it('並んだ状態からの決着は、リード者が変わったかどうかだけで決まる', () => {
    const m = summarize([record({ scores: [12, 12], leaderBeforeLastMove: 0, winner: 0 })])
    expect(m.lastTurnSwingRate).toBe(0)
  })

  it('割合として集計される', () => {
    const m = summarize([
      record({ leaderBeforeLastMove: 0, winner: 0 }),
      record({ leaderBeforeLastMove: 0, winner: 0 }),
      record({ leaderBeforeLastMove: 0, winner: 1 }),
      record({ leaderBeforeLastMove: 1, winner: 0 }),
    ])
    expect(m.lastTurnSwingRate).toBe(0.5)
  })
})

describe('カード別の集計', () => {
  it('勝率貢献は (試合, プレイヤー) 単位で、同じカードを複数置いても1標本', () => {
    const m = summarize([
      // p0 が勝ち、断崖を2枚置いた
      record({
        winner: 0,
        log: [entry(0, 'dangai', 'p0z0'), entry(0, 'dangai', 'p0z1'), entry(1, 'heigen', 'p1z0')],
      }),
      // p1 が勝ち、断崖を1枚置いた
      record({ winner: 1, log: [entry(0, 'kagero', 'p0z0'), entry(1, 'dangai', 'p1z0')] }),
    ])
    const dangai = m.cards.find((c) => c.id === 'dangai')!
    expect(dangai.samples).toBe(2) // 2つの (試合, プレイヤー) 組
    expect(dangai.winRate).toBe(1) // どちらも置いた側が勝った
    expect(dangai.placements).toBe(3) // 延べ3枚

    const heigen = m.cards.find((c) => c.id === 'heigen')!
    expect(heigen.samples).toBe(1)
    expect(heigen.winRate).toBe(0)
  })

  it('自ゾーン率は持ち主基準で数える', () => {
    const m = summarize([
      record({
        log: [
          entry(0, 'ashikase', 'p1z0'), // 相手ゾーンへ
          entry(0, 'ashikase', 'p1z1'), // 相手ゾーンへ
          entry(0, 'ashikase', 'p0z0'), // 自ゾーンへ
          entry(1, 'dangai', 'p1z0'), // 自ゾーンへ
        ],
      }),
    ])
    expect(m.cards.find((c) => c.id === 'ashikase')!.ownRate).toBeCloseTo(1 / 3)
    expect(m.cards.find((c) => c.id === 'dangai')!.ownRate).toBe(1)
  })

  it('12種すべてが結果に含まれ、未使用カードは標本0になる', () => {
    const m = summarize([record({ log: [entry(0, 'gekko', 'p0z0')] })])
    expect(m.cards).toHaveLength(12)
    const unused = m.cards.find((c) => c.id === 'horaana')!
    expect(unused.samples).toBe(0)
    expect(unused.winRate).toBe(0)
    expect(unused.placements).toBe(0)
  })

  it('安全弁で捨てた手はカードの設置として数えない', () => {
    const m = summarize([
      record({ log: [entry(0, 'gekko', 'p0z0', { discardOnly: true }), entry(1, 'gekko', 'p1z0')] }),
    ])
    expect(m.cards.find((c) => c.id === 'gekko')!.placements).toBe(1)
    expect(m.discardOnlyRate).toBe(0.5)
  })

  it('不発率を数える', () => {
    const m = summarize([
      record({ log: [entry(0, 'shiso', 'p0z0', { fizzled: true }), entry(1, 'shiso', 'p1z0')] }),
    ])
    expect(m.fizzleRate).toBe(0.5)
  })
})

describe('診断用の集計', () => {
  it('空ゾーン数と潰されたゾーン数を平均する', () => {
    const m = summarize([
      record({ emptyZones: 1, crushedZones: 0 }),
      record({ emptyZones: 3, crushedZones: 2 }),
    ])
    expect(m.avgEmptyZones).toBe(2)
    expect(m.avgCrushedZones).toBe(1)
  })

  it('ゾーンを潰した札の内訳を合算する', () => {
    const m = summarize([
      record({ crushedBy: { gekko: 1, ashikase: 0, other: 0 } }),
      record({ crushedBy: { gekko: 0, ashikase: 2, other: 1 } }),
    ])
    expect(m.crushedBy).toEqual({ gekko: 1, ashikase: 2, other: 1 })
  })

  it('最終手で勝敗が動かなかった試合に限った先攻勝率', () => {
    const m = summarize([
      record({ leaderBeforeLastMove: 0, winner: 0 }), // 動かず・先攻勝ち
      record({ leaderBeforeLastMove: 1, winner: 1 }), // 動かず・後攻勝ち
      record({ leaderBeforeLastMove: 0, winner: 1 }), // 動いた
    ])
    expect(m.firstPlayerWinRateStable).toBe(0.5)
    expect(m.lastMoverWinsSwing).toBe(1)
  })
})

describe('境界', () => {
  it('空の入力でも落ちない', () => {
    const m = summarize([])
    expect(m.games).toBe(0)
    expect(m.averageScore).toBe(0)
    expect(m.cards).toEqual([])
  })

  it('ログが空でも落ちない', () => {
    const m = summarize([record({ log: [] })])
    expect(m.fizzleRate).toBe(0)
    expect(m.cards.every((c) => c.samples === 0)).toBe(true)
  })
})
