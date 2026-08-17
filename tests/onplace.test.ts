// 設置時効果の5種。期待値は docs/カード効果テキスト.md の各カード【裁定】と
// docs/作業計画書.md §7 の表から起こしたもの。
import { describe, expect, it } from 'vitest'
import { applyMove } from '../src/core/apply.ts'
import type { GameState, Move } from '../src/core/types.ts'
import { zoneTotal } from '../src/core/value.ts'
import { canPlace, isRestricted } from '../src/core/zone.ts'
import { allCardUids, handIds, makeCard, makeState, withHand, zoneIds } from './helpers.ts'

/** current の手札の先頭カードを zone に置く手 */
function play(state: GameState, zone: Move['zone'], extra: Partial<Move> = {}): GameState {
  return applyMove(state, { cardUid: state.hands[state.current][0].uid, zone, ...extra })
}

describe('平原：手札をすべて山札に戻してシャッフルし、その後2枚引く', () => {
  it('置いた後の残り手札が山札に戻り、ちょうど2枚引き直す', () => {
    const s = withHand(makeState({}), ['heigen', 'dangai', 'kagero'])
    const returned = [s.hands[0][1].uid, s.hands[0][2].uid]
    const deckBefore = s.deck.length

    const next = play(s, 'p0z0')

    expect(next.hands[0]).toHaveLength(2)
    // 戻した2枚 − 引いた2枚 で山札の総数は変わらない
    expect(next.deck).toHaveLength(deckBefore)
    // 戻したカードは山札か新しい手札のどこかにある（捨て札には行かない）
    const pool = [...next.deck, ...next.hands[0]].map((c) => c.uid)
    for (const uid of returned) expect(pool).toContain(uid)
    expect(next.discard).toEqual([])
  })

  it('シャッフルするので rng が進む', () => {
    const s = withHand(makeState({}), ['heigen', 'dangai'])
    expect(play(s, 'p0z0').rng).not.toBe(s.rng)
  })

  it('引く枚数は手札が何枚でも固定2枚', () => {
    const s = withHand(makeState({}), ['heigen'])
    expect(play(s, 'p0z0').hands[0]).toHaveLength(2)
  })

  // 「両者が引き直す」案を実測したが、相手の悪い手札まで直してしまい逆効果だった
  // （作業計画書 §13 Phase 7）。相手の手札に触れないことをここで固定する
  it('相手の手札には触れない', () => {
    const s = withHand(withHand(makeState({}), ['heigen', 'dangai'], 0), ['soyoku', 'hanmo'], 1)
    expect(play(s, 'p0z0').hands[1]).toEqual(s.hands[1])
  })

  it('平原自身は盤面に残る（数値1）', () => {
    const s = withHand(makeState({}), ['heigen', 'dangai'])
    const next = play(s, 'p0z0')
    expect(zoneIds(next, 'p0z0')).toEqual(['heigen'])
    expect(zoneTotal(next, 'p0z0')).toBe(1)
  })

  it('カード総数30枚が保存される', () => {
    const s = withHand(makeState({}), ['heigen', 'dangai'])
    const uids = allCardUids(play(s, 'p0z0'))
    expect(new Set(uids).size).toBe(uids.length)
  })
})

describe('繁茂：次の相手のターン、相手はこのゾーンに置かなければならない', () => {
  it('設置したゾーンが強制先になる', () => {
    const s = withHand(makeState({}), ['hanmo'])
    expect(play(s, 'p0z0').forcedZone).toBe('p0z0')
  })

  it('相手のゾーンに置いても強制先はそのゾーン', () => {
    const s = withHand(makeState({}), ['hanmo'])
    expect(play(s, 'p1z1').forcedZone).toBe('p1z1')
  })

  it('繁茂以外を置いたら強制は立たない', () => {
    const s = withHand(makeState({}), ['dangai'])
    expect(play(s, 'p0z0').forcedZone).toBeNull()
  })

  it('強制で置かれたカードの設置時効果は通常どおり発動する', () => {
    // p0 が繁茂で p0z0 を指定 → p1 はそこに刺創を置き、対象を捨て札にできる
    const base = makeState({ p0z0: ['dangai'] })
    const s = withHand(base, ['hanmo'])
    const afterHanmo = play(s, 'p0z0')
    expect(afterHanmo.forcedZone).toBe('p0z0')

    const p1 = withHand(afterHanmo, ['shiso'], 1)
    const targetUid = p1.zones.p0z0.cards[0].uid
    const next = play(p1, 'p0z0', { targetUid })

    expect(next.discard.map((c) => c.defId)).toEqual(['dangai'])
    expect(zoneIds(next, 'p0z0')).toEqual(['hanmo', 'shiso'])
  })
})

describe('渦潮：このゾーンのカードを1枚、別のゾーンへ移動させる', () => {
  it('対象が移動元から消え、移動先に加わる。渦潮自身は残る', () => {
    const s = withHand(makeState({ p0z0: ['dangai'] }), ['uzushio'])
    const targetUid = s.zones.p0z0.cards[0].uid

    const next = play(s, 'p0z0', { targetUid, moveTo: 'p0z1' })

    expect(zoneIds(next, 'p0z0')).toEqual(['uzushio'])
    expect(zoneIds(next, 'p0z1')).toEqual(['dangai'])
  })

  it('相手ゾーンに置いて相手のカードを自分のゾーンへ強奪できる', () => {
    const s = withHand(makeState({ p1z0: ['kagero'] }), ['uzushio'])
    const targetUid = s.zones.p1z0.cards[0].uid

    const next = play(s, 'p1z0', { targetUid, moveTo: 'p0z0' })

    expect(zoneIds(next, 'p1z0')).toEqual(['uzushio'])
    expect(zoneIds(next, 'p0z0')).toEqual(['kagero'])
    expect(zoneTotal(next, 'p0z0')).toBe(3)
  })

  it('移動したカードの設置時効果は再発動しない（繁茂を動かしても強制は立たない）', () => {
    const s = withHand(makeState({ p0z0: ['hanmo'] }), ['uzushio'])
    const targetUid = s.zones.p0z0.cards[0].uid

    const next = play(s, 'p0z0', { targetUid, moveTo: 'p0z1' })

    expect(zoneIds(next, 'p0z1')).toEqual(['hanmo'])
    expect(next.forcedZone).toBeNull()
  })

  it('移動したカードの設置時効果は再発動しない（平原を動かしても引き直さない）', () => {
    const s = withHand(makeState({ p0z0: ['heigen'] }), ['uzushio', 'dangai'])
    const targetUid = s.zones.p0z0.cards[0].uid

    const next = play(s, 'p0z0', { targetUid, moveTo: 'p0z1' })

    expect(zoneIds(next, 'p0z1')).toEqual(['heigen'])
    expect(handIds(next, 0)).toEqual(['dangai']) // 引き直していない
    expect(next.hands[1]).toEqual(s.hands[1]) // 相手の手札も動かない
    expect(next.deck).toEqual(s.deck)
    expect(next.rng).toBe(s.rng)
  })

  it('移動したカードの設置時効果は再発動しない（疾風を動かしても手札交換しない）', () => {
    const base = withHand(makeState({ p0z0: ['shippu'] }), ['kagero'], 1)
    const s = withHand(base, ['uzushio', 'dangai'])
    const targetUid = s.zones.p0z0.cards[0].uid

    const next = play(s, 'p0z0', { targetUid, moveTo: 'p0z1' })

    expect(handIds(next, 0)).toEqual(['dangai'])
    expect(handIds(next, 1)).toEqual(['kagero'])
  })

  it('氷山を動かすと移動元の制限が解除され、移動先が制限される', () => {
    const s = withHand(makeState({ p0z0: ['hyozan'] }), ['uzushio'])
    const targetUid = s.zones.p0z0.cards[0].uid

    const next = play(s, 'p0z0', { targetUid, moveTo: 'p1z1' })

    // 移動元には渦潮だけが残る（渦潮は数値2なので制限は無関係）
    expect(isRestricted(next.zones.p0z0)).toBe(false)
    expect(isRestricted(next.zones.p1z1)).toBe(true)
    expect(canPlace(next.zones.p1z1, makeCard('dangai'))).toBe(false)
    expect(canPlace(next.zones.p1z1, makeCard('shippu'))).toBe(true)
  })

  it('対象がいなければ不発（ログに fizzled が残る）', () => {
    const s = withHand(makeState({}), ['uzushio'])
    const next = play(s, 'p0z0')

    expect(zoneIds(next, 'p0z0')).toEqual(['uzushio'])
    expect(next.log[0].fizzled).toBe(true)
    expect(zoneTotal(next, 'p0z0')).toBe(2) // 数値2のカードとして残る
  })

  it('カード総数30枚が保存される', () => {
    const s = withHand(makeState({ p0z0: ['dangai'] }), ['uzushio'])
    const targetUid = s.zones.p0z0.cards[0].uid
    const uids = allCardUids(play(s, 'p0z0', { targetUid, moveTo: 'p1z0' }))
    expect(new Set(uids).size).toBe(uids.length)
  })
})

describe('疾風：相手と手札をすべて交換する', () => {
  it('両者の手札が入れ替わる', () => {
    const base = withHand(makeState({}), ['kagero', 'gekko'], 1)
    const s = withHand(base, ['shippu', 'dangai'])

    const next = play(s, 'p0z0')

    // 使用者の手札は「疾風を置いた後の残り」が相手に渡る
    expect(handIds(next, 0)).toEqual(['kagero', 'gekko'])
    expect(handIds(next, 1)).toEqual(['dangai'])
  })

  it('両者2枚ずつなら枚数差は生じない', () => {
    const base = withHand(makeState({}), ['kagero', 'gekko'], 1)
    const s = withHand(base, ['shippu', 'dangai', 'heigen'])
    const next = play(s, 'p0z0')
    expect(next.hands[0]).toHaveLength(2)
    expect(next.hands[1]).toHaveLength(2)
  })

  it('盤面には疾風が置かれるだけ', () => {
    const s = withHand(makeState({}), ['shippu', 'dangai'])
    const next = play(s, 'p0z0')
    expect(zoneIds(next, 'p0z0')).toEqual(['shippu'])
    expect(next.discard).toEqual([])
  })
})

describe('刺創：このゾーンのカードを1枚、捨て札にする', () => {
  it('対象が捨て札へ移り、ゾーンから消える。刺創自身は残る', () => {
    const s = withHand(makeState({ p0z0: ['dangai', 'heigen'] }), ['shiso'])
    const targetUid = s.zones.p0z0.cards[0].uid

    const next = play(s, 'p0z0', { targetUid })

    expect(zoneIds(next, 'p0z0')).toEqual(['heigen', 'shiso'])
    expect(next.discard.map((c) => c.defId)).toEqual(['dangai'])
  })

  it('氷山を捨てるとそのゾーンの設置制限が解除される', () => {
    // 刺創は数値3なので、氷山ゾーンには置けない。氷山を別ゾーンに用意して壊す
    const s = withHand(makeState({ p0z0: ['hyozan', 'shippu'] }), ['uzushio'])
    expect(isRestricted(s.zones.p0z0)).toBe(true)
    const hyozanUid = s.zones.p0z0.cards[0].uid

    // 渦潮（数値2）なら氷山ゾーンに置けるので、そこから氷山を追い出す
    const next = play(s, 'p0z0', { targetUid: hyozanUid, moveTo: 'p1z1' })

    expect(isRestricted(next.zones.p0z0)).toBe(false)
    expect(canPlace(next.zones.p0z0, makeCard('dangai'))).toBe(true)
  })

  it('捨て札は平原でも山札に戻らない', () => {
    const s = withHand(makeState({ p0z0: ['dangai'] }), ['shiso', 'heigen'])
    const targetUid = s.zones.p0z0.cards[0].uid
    const afterShiso = play(s, 'p0z0', { targetUid })
    const discardedUid = afterShiso.discard[0].uid

    // 同じプレイヤーに手番を戻して平原を置く
    const p0Again: GameState = { ...afterShiso, current: 0 }
    const afterHeigen = applyMove(p0Again, { cardUid: p0Again.hands[0][0].uid, zone: 'p0z1' })

    expect(afterHeigen.deck.map((c) => c.uid)).not.toContain(discardedUid)
    expect(afterHeigen.discard.map((c) => c.uid)).toContain(discardedUid)
  })

  it('対象がいなければ不発。数値3のカードとして残る', () => {
    const s = withHand(makeState({}), ['shiso'])
    const next = play(s, 'p0z0')

    expect(zoneIds(next, 'p0z0')).toEqual(['shiso'])
    expect(next.discard).toEqual([])
    expect(next.log[0].fizzled).toBe(true)
    expect(zoneTotal(next, 'p0z0')).toBe(3)
  })

  it('カード総数30枚が保存される', () => {
    const s = withHand(makeState({ p0z0: ['dangai'] }), ['shiso'])
    const targetUid = s.zones.p0z0.cards[0].uid
    const uids = allCardUids(play(s, 'p0z0', { targetUid }))
    expect(new Set(uids).size).toBe(uids.length)
  })
})

describe('設置時効果を持たないカード', () => {
  it('盤面に置かれる以外は何も起きない', () => {
    const s = withHand(makeState({}), ['kagero', 'dangai'])
    const next = play(s, 'p0z0')

    expect(zoneIds(next, 'p0z0')).toEqual(['kagero'])
    expect(next.deck).toEqual(s.deck)
    expect(next.rng).toBe(s.rng)
    expect(next.discard).toEqual([])
    expect(next.hands[1]).toEqual(s.hands[1])
    expect(next.forcedZone).toBeNull()
    expect(next.log[0].fizzled).toBeUndefined()
  })
})

describe('不正な対象指定は例外', () => {
  it('刺創：対象がいるのに指定しない', () => {
    const s = withHand(makeState({ p0z0: ['dangai'] }), ['shiso'])
    expect(() => play(s, 'p0z0')).toThrow(/刺創/)
  })

  it('刺創：ゾーンにないカードを対象にする', () => {
    const s = withHand(makeState({ p0z0: ['dangai'], p0z1: ['heigen'] }), ['shiso'])
    const otherZoneUid = s.zones.p0z1.cards[0].uid
    expect(() => play(s, 'p0z0', { targetUid: otherZoneUid })).toThrow(/刺創/)
  })

  it('刺創：対象がいないのに指定する', () => {
    const s = withHand(makeState({}), ['shiso'])
    expect(() => play(s, 'p0z0', { targetUid: 12345 })).toThrow(/刺創/)
  })

  it('渦潮：移動先を元のゾーンにする', () => {
    const s = withHand(makeState({ p0z0: ['dangai'] }), ['uzushio'])
    const targetUid = s.zones.p0z0.cards[0].uid
    expect(() => play(s, 'p0z0', { targetUid, moveTo: 'p0z0' })).toThrow(/渦潮/)
  })

  it('渦潮：氷山ゾーンへ数値2以外のカードを送ろうとする', () => {
    const s = withHand(makeState({ p0z0: ['dangai'], p0z1: ['hyozan'] }), ['uzushio'])
    expect(isRestricted(s.zones.p0z1)).toBe(true)
    const targetUid = s.zones.p0z0.cards[0].uid // 断崖（本来3）
    expect(() => play(s, 'p0z0', { targetUid, moveTo: 'p0z1' })).toThrow(/渦潮/)
  })

  it('渦潮：対象だけ指定して移動先を省く', () => {
    const s = withHand(makeState({ p0z0: ['dangai'] }), ['uzushio'])
    const targetUid = s.zones.p0z0.cards[0].uid
    expect(() => play(s, 'p0z0', { targetUid })).toThrow(/渦潮/)
  })
})
