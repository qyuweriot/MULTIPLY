// 演出イベントの組み立て。docs/カード効果テキスト.md の設置時効果5種を、
// 「コアに手を入れずに LogEntry と前後の GameState だけから復元できるか」で確かめる。
import { describe, expect, it } from 'vitest'
import { applyMove } from '../src/core/apply.ts'
import type { GameState, Move, ZoneKey } from '../src/core/types.ts'
import { cardNameOf, describeEffect, findCard, isEffectZone } from '../src/ui/effects.ts'
import { makeState, uidOfNth, withHand } from './helpers.ts'

/** 手札の先頭を指定ゾーンへ置き、その1手を演出イベントに翻訳する */
function play(state: GameState, extra: Partial<Move> = {}, zone: ZoneKey = 'p0z0') {
  const move: Move = { cardUid: state.hands[state.current][0].uid, zone, ...extra }
  const after = applyMove(state, move)
  const event = describeEffect(state, after, 7)
  if (event === null) throw new Error('イベントが作られなかった')
  return { after, event }
}

describe('通常の設置', () => {
  it('置いたカード・ゾーン・使用者が記録され、余計な差分は付かない', () => {
    const s = withHand(makeState({}), ['dangai'])
    const { event } = play(s)

    expect(event.seq).toBe(7)
    expect(event.cardId).toBe('dangai')
    expect(event.cardUid).toBe(s.hands[0][0].uid)
    expect(event.player).toBe(0)
    expect(event.zone).toBe('p0z0')
    expect(event.removed).toEqual([])
    expect(event.moved).toBeUndefined()
    expect(event.fizzled).toBe(false)
    expect(event.forced).toBe(false)
    expect(event.discardOnly).toBe(false)
  })

  it('相手のゾーンに置いても、使用者は置いた側のまま', () => {
    const s = withHand(makeState({}), ['ashikase'])
    expect(play(s, {}, 'p1z0').event.player).toBe(0)
  })

  it('棋譜が空なら null（着手前の盤面では演出しない）', () => {
    expect(describeEffect(makeState({}), makeState({}), 1)).toBeNull()
  })

  it('棋譜が積み上がっても、見るのはつねに直前の1手', () => {
    const first = withHand(makeState({}), ['dangai'])
    const afterFirst = applyMove(first, { cardUid: first.hands[0][0].uid, zone: 'p0z0' })

    const second = withHand(afterFirst, ['kagero'], 1)
    const afterSecond = applyMove(second, { cardUid: second.hands[1][0].uid, zone: 'p1z0' })
    expect(afterSecond.log).toHaveLength(2)

    const event = describeEffect(second, afterSecond, 2)
    expect(event?.cardId).toBe('kagero')
    expect(event?.player).toBe(1)
    expect(event?.zone).toBe('p1z0')
  })
})

describe('刺創：盤面から取り除かれたカード', () => {
  it('捨て札にした対象が removed に入る', () => {
    const s = withHand(makeState({ p0z0: ['heigen', 'dangai'] }), ['shiso'])
    const target = uidOfNth(s, 'p0z0', 1)
    const { after, event } = play(s, { targetUid: target })

    expect(event.removed.map((c) => c.uid)).toEqual([target])
    expect(event.removed[0].defId).toBe('dangai')
    expect(event.fizzled).toBe(false)
    // 実際に捨て札へ移っている
    expect(after.discard.some((c) => c.uid === target)).toBe(true)
  })

  it('対象がいなければ不発で、removed は空', () => {
    const s = withHand(makeState({}), ['shiso'])
    const { event } = play(s)
    expect(event.fizzled).toBe(true)
    expect(event.removed).toEqual([])
  })
})

describe('渦潮：移動', () => {
  it('移動したカードと移動元・移動先が記録される', () => {
    const s = withHand(makeState({ p0z0: ['heigen'] }), ['uzushio'])
    const target = uidOfNth(s, 'p0z0', 0)
    const { event } = play(s, { targetUid: target, moveTo: 'p1z1' })

    expect(event.moved?.card.uid).toBe(target)
    expect(event.moved?.card.defId).toBe('heigen')
    expect(event.moved?.from).toBe('p0z0')
    expect(event.moved?.to).toBe('p1z1')
    // 移動しただけなので盤面から消えてはいない
    expect(event.removed).toEqual([])
    expect(event.fizzled).toBe(false)
  })

  it('対象がいなければ不発で、moved は付かない', () => {
    const s = withHand(makeState({}), ['uzushio'])
    const { event } = play(s)
    expect(event.fizzled).toBe(true)
    expect(event.moved).toBeUndefined()
  })
})

describe('平原・疾風：手札が入れ替わっても盤面は減らない', () => {
  it('平原で手札を山札に戻しても removed は空', () => {
    const s = withHand(makeState({ p0z0: ['dangai'] }), ['heigen', 'kagero', 'shiso'])
    const { event } = play(s)
    expect(event.cardId).toBe('heigen')
    expect(event.removed).toEqual([])
    expect(event.fizzled).toBe(false)
  })

  it('疾風は beginTurn の前に差分を取るので、手札交換だけが見える', () => {
    const base = withHand(makeState({}), ['shippu', 'dangai'])
    const s = withHand(base, ['kagero'], 1)
    const mine = base.hands[0][1].uid // 疾風と一緒に持っていた断崖
    const theirs = s.hands[1][0].uid

    const { after, event } = play(s)
    expect(event.cardId).toBe('shippu')
    expect(event.removed).toEqual([])
    // 交換後：使用者の手札は相手のものに、相手の手札は使用者の残りになる
    expect(after.hands[0].map((c) => c.uid)).toEqual([theirs])
    expect(after.hands[1].map((c) => c.uid)).toEqual([mine])
  })
})

describe('繁茂の強制と安全弁', () => {
  it('強制に従って置いた手は forced が立つ', () => {
    const base = withHand(makeState({}), ['dangai'])
    const s: GameState = { ...base, forcedZone: 'p1z1' }
    expect(play(s, {}, 'p1z1').event.forced).toBe(true)
  })

  it('強制が不発なら forced は立たない', () => {
    // p1z1 は氷山ゾーン。断崖（本来3）は置けないので強制は不発
    const base = withHand(makeState({ p1z1: ['hyozan'] }), ['dangai'])
    const s: GameState = { ...base, forcedZone: 'p1z1' }
    expect(play(s, {}, 'p0z0').event.forced).toBe(false)
  })

  it('置ける場所がなく捨てただけの手は discardOnly が立つ', () => {
    const s = withHand(
      makeState({ p0z0: ['hyozan'], p0z1: ['hyozan'], p1z0: ['hyozan'], p1z1: ['hyozan'] }),
      ['dangai'],
    )
    const { event } = play(s, { discardOnly: true })
    expect(event.discardOnly).toBe(true)
    expect(event.removed).toEqual([])
  })
})

describe('演出を出すゾーンの判定', () => {
  it('渦潮は移動元と移動先の両方が対象になる', () => {
    const s = withHand(makeState({ p0z0: ['heigen'] }), ['uzushio'])
    const { event } = play(s, { targetUid: uidOfNth(s, 'p0z0', 0), moveTo: 'p1z1' })

    expect(isEffectZone(event, 'p0z0')).toBe(true)
    expect(isEffectZone(event, 'p1z1')).toBe(true)
    expect(isEffectZone(event, 'p0z1')).toBe(false)
  })

  it('通常のカードは置いたゾーンだけ', () => {
    const s = withHand(makeState({}), ['dangai'])
    const { event } = play(s, {}, 'p1z0')
    expect(isEffectZone(event, 'p1z0')).toBe(true)
    expect(isEffectZone(event, 'p0z0')).toBe(false)
  })

  it('捨てただけの手はどのゾーンも光らせない', () => {
    const s = withHand(
      makeState({ p0z0: ['hyozan'], p0z1: ['hyozan'], p1z0: ['hyozan'], p1z1: ['hyozan'] }),
      ['dangai'],
    )
    const { event } = play(s, { discardOnly: true })
    expect(isEffectZone(event, 'p0z0')).toBe(false)
  })

  it('演出がなければ光らない', () => {
    expect(isEffectZone(null, 'p0z0')).toBe(false)
  })
})

describe('uid からカードを引く', () => {
  it('手札・山札・捨て札・ゾーンのどこにあっても見つかる', () => {
    const s = withHand(makeState({ p1z1: ['gekko'] }), ['kagero'])
    expect(findCard(s, s.hands[0][0].uid)?.defId).toBe('kagero')
    expect(findCard(s, uidOfNth(s, 'p1z1', 0))?.defId).toBe('gekko')
    expect(findCard(s, s.deck[0].uid)).toBeDefined()
  })

  it('カード名が引ける。見つからなければ uid をそのまま出す', () => {
    const s = withHand(makeState({}), ['kagero'])
    expect(cardNameOf(s, s.hands[0][0].uid)).toBe('陽炎')
    expect(cardNameOf(s, 999999)).toBe('#999999')
  })
})
