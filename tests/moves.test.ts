// 合法手の列挙。期待値は docs/作業計画書.md §8 と
// docs/カード効果テキスト.md の渦潮・刺創・繁茂【裁定】から起こしたもの。
import { describe, expect, it } from 'vitest'
import { legalMoves } from '../src/core/moves.ts'
import type { CardId, GameState, ZoneKey } from '../src/core/types.ts'
import { ALL_ZONES } from '../src/core/types.ts'
import { makeState, withHand } from './helpers.ts'

const zonesUsed = (moves: { zone: ZoneKey }[]) => [...new Set(moves.map((m) => m.zone))].sort()

describe('設置先の候補', () => {
  it('通常カードは (手札 × 設置先) の直積になる', () => {
    const s = withHand(makeState({}), ['dangai', 'heigen'])
    const moves = legalMoves(s, null)
    expect(moves).toHaveLength(2 * 4)
    expect(zonesUsed(moves)).toEqual([...ALL_ZONES].sort())
  })

  it('氷山ゾーンは数値2以外のカードの設置先に含まれない', () => {
    const s = withHand(makeState({ p0z0: ['hyozan'] }), ['dangai'])
    expect(zonesUsed(legalMoves(s, null))).toEqual(['p0z1', 'p1z0', 'p1z1'])
  })

  it('数値2のカードなら氷山ゾーンにも置ける', () => {
    const s = withHand(makeState({ p0z0: ['hyozan'] }), ['uzushio'])
    expect(zonesUsed(legalMoves(s, null))).toEqual([...ALL_ZONES].sort())
  })

  it('相手のゾーンにも置ける（妨害札の前提）', () => {
    const moves = legalMoves(withHand(makeState({}), ['ashikase']), null)
    expect(moves.some((m) => m.zone === 'p1z0')).toBe(true)
  })
})

describe('繁茂による強制', () => {
  it('強制先が空いていればそのゾーンだけに限定される', () => {
    const s = withHand(makeState({}), ['dangai', 'heigen'])
    const moves = legalMoves(s, 'p1z1')
    expect(zonesUsed(moves)).toEqual(['p1z1'])
    expect(moves).toHaveLength(2)
  })

  it('強制先にそのカードを置けないなら不発になり、自由に置ける', () => {
    const s = withHand(makeState({ p0z0: ['hyozan'] }), ['dangai'])
    expect(zonesUsed(legalMoves(s, 'p0z0'))).toEqual(['p0z1', 'p1z0', 'p1z1'])
  })

  it('force 省略時は state.forcedZone が使われる', () => {
    const base = withHand(makeState({}), ['dangai'])
    const s: GameState = { ...base, forcedZone: 'p1z0' }
    expect(zonesUsed(legalMoves(s))).toEqual(['p1z0'])
  })
})

describe('刺創の対象', () => {
  it('空ゾーンに置く場合は不発（targetUid なしの手が1つ）', () => {
    const s = withHand(makeState({}), ['shiso'])
    const moves = legalMoves(s, 'p0z0')
    expect(moves).toEqual([{ cardUid: s.hands[0][0].uid, zone: 'p0z0' }])
  })

  it('ゾーン内の各カードが対象候補になる', () => {
    const s = withHand(makeState({ p0z0: ['heigen', 'hanmo', 'dangai'] }), ['shiso'])
    const moves = legalMoves(s, 'p0z0')
    expect(moves).toHaveLength(3)
    expect(moves.map((m) => m.targetUid).sort()).toEqual(
      s.zones.p0z0.cards.map((c) => c.uid).sort(),
    )
  })

  it('刺創自身は対象に含まれない', () => {
    const s = withHand(makeState({ p0z0: ['heigen'] }), ['shiso'])
    const shisoUid = s.hands[0][0].uid
    const moves = legalMoves(s, 'p0z0')
    expect(moves.every((m) => m.targetUid !== shisoUid)).toBe(true)
  })
})

describe('渦潮の対象と移動先', () => {
  it('(対象 × 移動先) の直積が列挙される', () => {
    const s = withHand(makeState({ p0z0: ['heigen', 'hanmo'] }), ['uzushio'])
    const moves = legalMoves(s, 'p0z0')
    // 対象2枚 × 移動先3ゾーン（元ゾーンを除く）
    expect(moves).toHaveLength(6)
    expect(moves.every((m) => m.targetUid !== undefined && m.moveTo !== undefined)).toBe(true)
  })

  it('移動先に元のゾーンは含まれない（＝何もしないは選べない）', () => {
    const s = withHand(makeState({ p0z0: ['heigen'] }), ['uzushio'])
    const moves = legalMoves(s, 'p0z0')
    expect(moves.every((m) => m.moveTo !== 'p0z0')).toBe(true)
  })

  it('渦潮自身は移動対象に選べない', () => {
    const s = withHand(makeState({ p0z0: ['heigen'] }), ['uzushio'])
    const uzushioUid = s.hands[0][0].uid
    expect(legalMoves(s, 'p0z0').every((m) => m.targetUid !== uzushioUid)).toBe(true)
  })

  it('対象がいなければ不発', () => {
    const s = withHand(makeState({}), ['uzushio'])
    expect(legalMoves(s, 'p0z0')).toEqual([{ cardUid: s.hands[0][0].uid, zone: 'p0z0' }])
  })

  it('移動先が1つもなければ不発', () => {
    // 移動対象は平原（本来1）。他の3ゾーンはすべて氷山なので送り込めない
    const s = withHand(
      makeState({
        p0z0: ['heigen'],
        p0z1: ['hyozan'],
        p1z0: ['hyozan'],
        p1z1: ['hyozan'],
      }),
      ['uzushio'],
    )
    const moves = legalMoves(s, 'p0z0')
    expect(moves).toEqual([{ cardUid: s.hands[0][0].uid, zone: 'p0z0' }])
  })
})

describe('安全弁', () => {
  it('置ける場所が1つもなければ discardOnly の手が手札枚数ぶん返る', () => {
    // ルール上は氷山3枚しかないので到達しないが、安全弁の動作自体を確かめる
    const full: CardId[] = ['hyozan']
    const s = withHand(
      makeState({ p0z0: full, p0z1: full, p1z0: full, p1z1: full }),
      ['dangai', 'heigen'],
    )
    const moves = legalMoves(s, null)
    expect(moves).toHaveLength(2)
    expect(moves.every((m) => m.discardOnly === true)).toBe(true)
    expect(moves.map((m) => m.cardUid).sort()).toEqual(s.hands[0].map((c) => c.uid).sort())
  })

  it('手札が空なら合法手は0件', () => {
    expect(legalMoves(withHand(makeState({}), []), null)).toEqual([])
  })
})
