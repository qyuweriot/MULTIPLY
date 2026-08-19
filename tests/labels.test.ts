// 表示名（作業計画書 §1-3）。
//
// 内部識別子（p0z0 等）は変えずに表示だけ差し替えられる設計になっているか、
// そして呼称が対戦相手モードで正しく切り替わるかを固定する。
import { describe, expect, it } from 'vitest'
import { ALL_ZONES } from '../src/core/types.ts'
import { playerLabels, zoneName, ZONE_LABELS } from '../src/labels.ts'

const HOTSEAT = playerLabels(false)
const VS_CPU = playerLabels(true)

describe('プレイヤーの呼称', () => {
  it('人間同士は Player1 / Player2', () => {
    expect(HOTSEAT).toEqual(['Player1', 'Player2'])
  })

  // CPU が受け持つのは後攻（App.tsx の CPU_PLAYER = 1）。ここが入れ替わると
  // 「自分の手札」と「CPU の手札」が逆に見える
  it('CPU 戦は先攻が Player、後攻が CPU', () => {
    expect(VS_CPU).toEqual(['Player', 'CPU'])
  })

  it('モードで呼称が変わる', () => {
    expect(HOTSEAT).not.toEqual(VS_CPU)
  })
})

describe('ゾーンの呼称', () => {
  it('L と R', () => {
    expect(ZONE_LABELS).toEqual({ z0: 'L', z1: 'R' })
  })

  it('持ち主つきの名前はハイフンでつなぐ', () => {
    expect(zoneName('p0z0', HOTSEAT)).toBe('Player1-L')
    expect(zoneName('p0z1', HOTSEAT)).toBe('Player1-R')
    expect(zoneName('p1z0', HOTSEAT)).toBe('Player2-L')
    expect(zoneName('p1z1', HOTSEAT)).toBe('Player2-R')
  })

  it('CPU 戦では後攻側が CPU になる', () => {
    expect(zoneName('p0z0', VS_CPU)).toBe('Player-L')
    expect(zoneName('p1z0', VS_CPU)).toBe('CPU-L')
    expect(zoneName('p1z1', VS_CPU)).toBe('CPU-R')
  })

  it('4つのゾーンがすべて別の名前になる', () => {
    for (const labels of [HOTSEAT, VS_CPU]) {
      const names = ALL_ZONES.map((z) => zoneName(z, labels))
      expect(new Set(names).size).toBe(4)
    }
  })

  it('内部識別子は表示名に漏れない', () => {
    for (const z of ALL_ZONES) {
      expect(zoneName(z, HOTSEAT)).not.toContain(z)
    }
  })
})
