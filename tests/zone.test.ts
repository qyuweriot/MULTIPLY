// 氷山によるゾーンロックの管理。期待値は docs/作業計画書.md §9 の表と
// docs/カード効果テキスト.md の氷山【裁定】から起こしたもの。
import { describe, expect, it } from 'vitest'
import { canAccept, isFull, onEnter, onLeave } from '../src/core/zone.ts'
import { ALL_ZONES } from '../src/core/types.ts'
import { emptyZone, makeCard, makeState, zoneWith } from './helpers.ts'

describe('§9 ゾーンロック', () => {
  it('#1 空ゾーンに氷山 → 1枚設置で満杯', () => {
    const locked = onEnter(emptyZone(), makeCard('hyozan'))
    expect(locked.lockThreshold).toBe(2)
    expect(isFull(locked)).toBe(false) // あと1枚置ける

    const full = onEnter(locked, makeCard('heigen'))
    expect(full.cards).toHaveLength(2)
    expect(isFull(full)).toBe(true)
  })

  it('#2 2枚あるゾーンに氷山 → 4枚で満杯', () => {
    const locked = onEnter(zoneWith('heigen', 'hanmo'), makeCard('hyozan'))
    expect(locked.cards).toHaveLength(3)
    expect(locked.lockThreshold).toBe(4)
    expect(isFull(locked)).toBe(false)

    const full = onEnter(locked, makeCard('dangai'))
    expect(full.cards).toHaveLength(4)
    expect(isFull(full)).toBe(true)
  })

  it('#3 氷山のみのゾーンに2枚目の氷山 → まだ1枚置ける（上書き）', () => {
    const one = zoneWith('hyozan')
    expect(one.lockThreshold).toBe(2)

    const two = onEnter(one, makeCard('hyozan'))
    expect(two.cards).toHaveLength(2)
    expect(two.lockThreshold).toBe(3) // 「あと1枚」にリセットされる
    expect(isFull(two)).toBe(false)

    expect(isFull(onEnter(two, makeCard('heigen')))).toBe(true)
  })

  it('#4 満杯ゾーンの氷山を破壊 → 制限解除、再度置けるようになる', () => {
    // 氷山を置いた時点で「あと1枚」→ もう1枚積んで満杯にする
    const full = zoneWith('heigen', 'hyozan', 'dangai')
    expect(full.lockThreshold).toBe(3)
    expect(isFull(full)).toBe(true)

    const hyozan = full.cards.find((c) => c.defId === 'hyozan')!
    const freed = onLeave(full, hyozan)
    expect(freed.cards).toHaveLength(2)
    expect(freed.lockThreshold).toBeNull()
    expect(isFull(freed)).toBe(false)
    expect(isFull(onEnter(freed, makeCard('dangai')))).toBe(false)
  })

  it('#5 氷山2枚のゾーンで1枚破壊 → 制限は維持される', () => {
    const two = zoneWith('hyozan', 'hyozan')
    expect(two.lockThreshold).toBe(3)

    const left = onLeave(two, two.cards[0])
    expect(left.cards).toHaveLength(1)
    expect(left.lockThreshold).toBe(3) // 残った氷山の制限をそのまま維持
    expect(isFull(left)).toBe(false)
  })

  it('#6 氷山3枚を3ゾーンに配置して全ロックしても、4つ目のゾーンは必ず空いている', () => {
    const state = makeState({
      p0z0: ['hyozan', 'heigen'], // 満杯
      p0z1: ['hyozan', 'hanmo'], // 満杯
      p1z0: ['hyozan', 'dangai'], // 満杯
      p1z1: ['heigen', 'hanmo', 'dangai', 'shiso'], // 氷山がないので制限なし
    })
    const locked = ALL_ZONES.filter((z) => isFull(state.zones[z]))
    expect(locked).toEqual(['p0z0', 'p0z1', 'p1z0'])
    expect(locked.length).toBeLessThanOrEqual(3) // 氷山は3枚しかない
    expect(isFull(state.zones.p1z1)).toBe(false)
    expect(canAccept(state.zones.p1z1)).toBe(true)
  })
})

describe('ロック解除の条件', () => {
  it('氷山以外のカードが離れても制限は変わらない', () => {
    const zone = zoneWith('hyozan', 'heigen')
    const heigen = zone.cards.find((c) => c.defId === 'heigen')!
    const after = onLeave(zone, heigen)
    expect(after.lockThreshold).toBe(2)
    expect(after.cards.map((c) => c.defId)).toEqual(['hyozan'])
    expect(isFull(after)).toBe(false) // 1枚減ったので再び置ける
  })

  it('制限のないゾーンから何枚抜いても lockThreshold は null のまま', () => {
    const zone = zoneWith('heigen', 'hanmo')
    expect(onLeave(zone, zone.cards[0]).lockThreshold).toBeNull()
  })

  it('渦潮で氷山が別ゾーンへ移動すると、移動元は解除・移動先はロックされる', () => {
    const from = zoneWith('heigen', 'hyozan')
    const to = zoneWith('dangai')
    const hyozan = from.cards.find((c) => c.defId === 'hyozan')!

    const fromAfter = onLeave(from, hyozan)
    const toAfter = onEnter(to, hyozan)

    expect(fromAfter.lockThreshold).toBeNull()
    expect(toAfter.lockThreshold).toBe(3)
    expect(isFull(toAfter)).toBe(false)
  })

  it('ロック中のゾーンには必ず氷山がある', () => {
    const zones = [
      zoneWith('hyozan', 'heigen'),
      zoneWith('hyozan', 'hyozan', 'heigen'),
      zoneWith('heigen', 'hanmo', 'hyozan', 'dangai'),
    ]
    for (const zone of zones) {
      if (isFull(zone)) {
        expect(zone.cards.some((c) => c.defId === 'hyozan')).toBe(true)
      }
    }
  })
})

describe('純粋性', () => {
  it('onEnter は入力のゾーンを変更しない', () => {
    const zone = zoneWith('heigen')
    const before = JSON.stringify(zone)
    onEnter(zone, makeCard('hyozan'))
    expect(JSON.stringify(zone)).toBe(before)
  })

  it('onLeave は入力のゾーンを変更しない', () => {
    const zone = zoneWith('heigen', 'hyozan')
    const before = JSON.stringify(zone)
    onLeave(zone, zone.cards[1])
    expect(JSON.stringify(zone)).toBe(before)
  })

  it('onLeave に存在しない uid を渡してもゾーンは変わらない', () => {
    const zone = zoneWith('heigen', 'hyozan')
    const after = onLeave(zone, makeCard('dangai'))
    expect(after.cards.map((c) => c.uid)).toEqual(zone.cards.map((c) => c.uid))
    expect(after.lockThreshold).toBe(zone.lockThreshold)
  })
})
