// 氷山による設置制限。期待値は docs/カード効果テキスト.md の氷山【裁定】から起こしたもの。
//
//   「このゾーンには、本来の数値が2のカードしか置くことができない。」
//
// 本来の数値が2なのは 氷山・渦潮・疾風（各3枚＝計9枚）。
import { describe, expect, it } from 'vitest'
import { legalMoves } from '../src/core/moves.ts'
import type { CardId, GameState } from '../src/core/types.ts'
import { ALL_ZONES } from '../src/core/types.ts'
import { canPlace, isRestricted, onEnter, onLeave } from '../src/core/zone.ts'
import { emptyZone, makeCard, makeState, withHand, zoneWith } from './helpers.ts'

/** 本来の数値ごとの代表カード */
const VALUE_2: CardId[] = ['hyozan', 'uzushio', 'shippu']
const NOT_2: CardId[] = ['shiso', 'kagero', 'dangai', 'soyoku', 'heigen', 'hanmo', 'gekko', 'horaana', 'ashikase']

describe('氷山のあるゾーン', () => {
  it('本来の数値が2のカード（氷山・渦潮・疾風）は置ける', () => {
    const zone = zoneWith('hyozan')
    expect(isRestricted(zone)).toBe(true)
    for (const id of VALUE_2) {
      expect(canPlace(zone, makeCard(id)), id).toBe(true)
    }
  })

  it('本来の数値が2以外のカードは置けない', () => {
    const zone = zoneWith('hyozan')
    for (const id of NOT_2) {
      expect(canPlace(zone, makeCard(id)), id).toBe(false)
    }
  })

  it('氷山自身も数値2なので、同じゾーンに重ねられる', () => {
    const one = zoneWith('hyozan')
    const two = onEnter(one, makeCard('hyozan'))
    expect(two.cards).toHaveLength(2)
    expect(canPlace(two, makeCard('hyozan'))).toBe(true)
  })

  it('枚数の上限はない（数値2なら何枚でも積める）', () => {
    let zone = zoneWith('hyozan')
    for (let i = 0; i < 5; i++) zone = onEnter(zone, makeCard('shippu'))
    expect(zone.cards).toHaveLength(6)
    expect(canPlace(zone, makeCard('uzushio'))).toBe(true)
  })
})

describe('氷山のないゾーン', () => {
  it('何でも置ける', () => {
    const zone = zoneWith('dangai', 'heigen', 'gekko')
    expect(isRestricted(zone)).toBe(false)
    for (const id of [...VALUE_2, ...NOT_2]) {
      expect(canPlace(zone, makeCard(id)), id).toBe(true)
    }
  })

  it('空ゾーンにも何でも置ける', () => {
    expect(canPlace(emptyZone(), makeCard('ashikase'))).toBe(true)
  })
})

describe('★判定は本来の数値で行う', () => {
  it('月光で0になっている断崖でも「本来3」なので置けない', () => {
    // 月光があるゾーンでは断崖の現在値は0だが、判定に使うのは本来の数値
    const state = makeState({ p0z0: ['gekko', 'dangai'], p0z1: ['hyozan'] })
    const dangai = state.zones.p0z0.cards[1]
    expect(canPlace(state.zones.p0z1, dangai)).toBe(false)
  })

  it('双翼が成立して3になっていても「本来1」なので置けない', () => {
    const state = makeState({ p0z0: ['soyoku'], p0z1: ['soyoku', 'hyozan'] })
    const soyoku = state.zones.p0z0.cards[0]
    expect(canPlace(state.zones.p0z1, soyoku)).toBe(false)
  })

  it('月光で0になっている疾風は「本来2」なので置ける', () => {
    const state = makeState({ p0z0: ['gekko', 'shippu'], p0z1: ['hyozan'] })
    const shippu = state.zones.p0z0.cards[1]
    expect(canPlace(state.zones.p0z1, shippu)).toBe(true)
  })
})

describe('制限の解除', () => {
  it('氷山がゾーンを離れると制限が解除される', () => {
    const zone = zoneWith('shippu', 'hyozan')
    expect(isRestricted(zone)).toBe(true)

    const hyozan = zone.cards.find((c) => c.defId === 'hyozan')!
    const freed = onLeave(zone, hyozan)
    expect(isRestricted(freed)).toBe(false)
    expect(canPlace(freed, makeCard('dangai'))).toBe(true)
  })

  it('氷山2枚のうち1枚が離れても制限は維持される', () => {
    const two = zoneWith('hyozan', 'hyozan')
    const left = onLeave(two, two.cards[0])
    expect(left.cards).toHaveLength(1)
    expect(isRestricted(left)).toBe(true)
    expect(canPlace(left, makeCard('dangai'))).toBe(false)
  })

  it('氷山以外のカードが離れても制限は変わらない', () => {
    const zone = zoneWith('hyozan', 'shippu')
    const shippu = zone.cards.find((c) => c.defId === 'shippu')!
    const after = onLeave(zone, shippu)
    expect(isRestricted(after)).toBe(true)
  })

  it('渦潮で氷山が別ゾーンへ移ると、制限も移る', () => {
    const from = zoneWith('shippu', 'hyozan')
    const to = zoneWith('dangai')
    const hyozan = from.cards.find((c) => c.defId === 'hyozan')!

    expect(isRestricted(onLeave(from, hyozan))).toBe(false)
    expect(isRestricted(onEnter(to, hyozan))).toBe(true)
  })
})

describe('置き場所は必ず残る', () => {
  it('氷山3枚を3ゾーンに配置しても、4つ目のゾーンは自由なまま', () => {
    const state = makeState({
      p0z0: ['hyozan'],
      p0z1: ['hyozan'],
      p1z0: ['hyozan'],
      p1z1: ['heigen', 'hanmo'],
    })
    const restricted = ALL_ZONES.filter((z) => isRestricted(state.zones[z]))
    expect(restricted).toEqual(['p0z0', 'p0z1', 'p1z0'])
    expect(restricted.length).toBeLessThanOrEqual(3) // 氷山は3枚しかない
    expect(canPlace(state.zones.p1z1, makeCard('ashikase'))).toBe(true)
  })

  it('3ゾーンが氷山でも、数値2以外のカードに必ず合法手がある', () => {
    const base = makeState({ p0z0: ['hyozan'], p0z1: ['hyozan'], p1z0: ['hyozan'] })
    const s = withHand(base, ['ashikase', 'gekko'])
    const moves = legalMoves(s, null)
    expect(moves.length).toBeGreaterThan(0)
    expect(moves.every((m) => m.zone === 'p1z1')).toBe(true)
    expect(moves.every((m) => m.discardOnly !== true)).toBe(true)
  })
})

describe('合法手との連動', () => {
  it('氷山ゾーンは数値2以外のカードの設置先に出てこない', () => {
    const s = withHand(makeState({ p0z0: ['hyozan'] }), ['dangai'])
    const zones = [...new Set(legalMoves(s, null).map((m) => m.zone))].sort()
    expect(zones).toEqual(['p0z1', 'p1z0', 'p1z1'])
  })

  it('数値2のカードなら氷山ゾーンにも置ける', () => {
    const s = withHand(makeState({ p0z0: ['hyozan'] }), ['shippu'])
    const zones = [...new Set(legalMoves(s, null).map((m) => m.zone))].sort()
    expect(zones).toEqual([...ALL_ZONES].sort())
  })

  it('渦潮の移動先は「移動するカード」で判定される', () => {
    // p0z0 に断崖(3)と疾風(2)。p0z1 は氷山ゾーン
    const state = makeState({ p0z0: ['dangai', 'shippu'], p0z1: ['hyozan'] })
    const s: GameState = { ...state, hands: [[makeCard('uzushio')], state.hands[1]] }
    const moves = legalMoves(s, 'p0z0')

    const dangaiUid = state.zones.p0z0.cards[0].uid
    const shippuUid = state.zones.p0z0.cards[1].uid
    const destsOf = (uid: number) =>
      [...new Set(moves.filter((m) => m.targetUid === uid).map((m) => m.moveTo))].sort()

    expect(destsOf(dangaiUid)).toEqual(['p1z0', 'p1z1']) // 断崖は氷山ゾーンへ送れない
    expect(destsOf(shippuUid)).toEqual(['p0z1', 'p1z0', 'p1z1']) // 疾風は送れる
  })

  it('繁茂の強制先に置けないカードなら、強制は不発になる', () => {
    const s = withHand(makeState({ p1z1: ['hyozan'] }), ['dangai'])
    const zones = [...new Set(legalMoves(s, 'p1z1').map((m) => m.zone))].sort()
    expect(zones).toEqual(['p0z0', 'p0z1', 'p1z0'])
  })
})

describe('純粋性', () => {
  it('onEnter は入力のゾーンを変更しない', () => {
    const zone = zoneWith('shippu')
    const before = JSON.stringify(zone)
    onEnter(zone, makeCard('hyozan'))
    expect(JSON.stringify(zone)).toBe(before)
  })

  it('onLeave は入力のゾーンを変更しない', () => {
    const zone = zoneWith('shippu', 'hyozan')
    const before = JSON.stringify(zone)
    onLeave(zone, zone.cards[1])
    expect(JSON.stringify(zone)).toBe(before)
  })

  it('onLeave に存在しない uid を渡してもゾーンは変わらない', () => {
    const zone = zoneWith('shippu', 'hyozan')
    const after = onLeave(zone, makeCard('dangai'))
    expect(after.cards.map((c) => c.uid)).toEqual(zone.cards.map((c) => c.uid))
  })
})
