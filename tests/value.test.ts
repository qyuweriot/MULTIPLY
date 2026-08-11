// 数値計算エンジンのゴールデンテスト。
// 期待値は docs/作業計画書.md §9 の表と docs/カード効果テキスト.md の【裁定】から起こしたもの。
import { describe, expect, it } from 'vitest'
import { cardValues, score, zoneTotal } from '../src/core/value.ts'
import type { GameState, ZoneKey } from '../src/core/types.ts'
import { makeState } from './helpers.ts'

/** ゾーンに置かれた順に現在値を並べる（uid を意識せず個別値を検証するため） */
function valuesInOrder(state: GameState, key: ZoneKey): number[] {
  const values = cardValues(state, key)
  return state.zones[key].cards.map((c) => values.get(c.uid) as number)
}

describe('§9 ゴールデンテスト', () => {
  it('#1 月光 + 断崖 → 合計 0（月光が本来の数値3を見て0に確定、断崖の自己条件で上書きされない）', () => {
    const s = makeState({ p0z0: ['gekko', 'dangai'] })
    expect(valuesInOrder(s, 'p0z0')).toEqual([0, 0])
    expect(zoneTotal(s, 'p0z0')).toBe(0)
  })

  it('#2 月光 + 双翼（他ゾーンにも双翼）→ 合計 3（月光は本来の数値1を見て3にする）', () => {
    const s = makeState({ p0z0: ['gekko', 'soyoku'], p0z1: ['soyoku'] })
    expect(valuesInOrder(s, 'p0z0')).toEqual([0, 3])
    expect(zoneTotal(s, 'p0z0')).toBe(3)
  })

  it('#3 月光 + 足枷 → 合計 0（月光が足枷を解除：-2 → 0）', () => {
    const s = makeState({ p0z0: ['gekko', 'ashikase'] })
    expect(valuesInOrder(s, 'p0z0')).toEqual([0, 0])
    expect(zoneTotal(s, 'p0z0')).toBe(0)
  })

  it('#4 陽炎 + 月光 + 断崖 → 合計 6（陽炎が全変動を無効化：3+0+3）', () => {
    const s = makeState({ p0z0: ['kagero', 'gekko', 'dangai'] })
    expect(valuesInOrder(s, 'p0z0')).toEqual([3, 0, 3])
    expect(zoneTotal(s, 'p0z0')).toBe(6)
  })

  it('#5 陽炎 + 洞穴 + 断崖 → 合計 6（洞穴が無効化され数値0のカードとして通常計算：3+0+3）', () => {
    const s = makeState({ p0z0: ['kagero', 'horaana', 'dangai'] })
    expect(valuesInOrder(s, 'p0z0')).toEqual([3, 0, 3])
    expect(zoneTotal(s, 'p0z0')).toBe(6)
  })

  it('#6 洞穴 + 月光 + 刺創（陽炎なし）→ 合計 5（洞穴が合計を上書き、月光は無意味）', () => {
    const s = makeState({ p0z0: ['horaana', 'gekko', 'shiso'] })
    expect(zoneTotal(s, 'p0z0')).toBe(5)
  })

  it('#7 洞穴 + 洞穴 → 合計 5（同ゾーン2枚でも5）', () => {
    const s = makeState({ p0z0: ['horaana', 'horaana'] })
    expect(zoneTotal(s, 'p0z0')).toBe(5)
  })

  it('#8 双翼2枚が片方のゾーンのみ → 合計 2（両ゾーンに必要。片寄せでは成立しない）', () => {
    const s = makeState({ p0z0: ['soyoku', 'soyoku'], p0z1: [] })
    expect(valuesInOrder(s, 'p0z0')).toEqual([1, 1])
    expect(zoneTotal(s, 'p0z0')).toBe(2)
  })

  it('#9 陽炎+双翼のゾーン／双翼のみのゾーン → 前者の双翼 1、後者 3（陽炎は存在判定を妨げない）', () => {
    const s = makeState({ p0z0: ['kagero', 'soyoku'], p0z1: ['soyoku'] })
    expect(valuesInOrder(s, 'p0z0')).toEqual([3, 1])
    expect(valuesInOrder(s, 'p0z1')).toEqual([3])
  })

  it('#10 断崖 + 平原 + 繁茂 → 合計 2（断崖自身を数えて3枚 → 断崖0）', () => {
    const s = makeState({ p0z0: ['dangai', 'heigen', 'hanmo'] })
    expect(valuesInOrder(s, 'p0z0')).toEqual([0, 1, 1])
    expect(zoneTotal(s, 'p0z0')).toBe(2)
  })

  it('#11 足枷 + 任意4枚 → 足枷が 0（足枷自身を数えて5枚）', () => {
    const s = makeState({ p0z0: ['ashikase', 'heigen', 'heigen', 'hanmo', 'hanmo'] })
    expect(valuesInOrder(s, 'p0z0')).toEqual([0, 1, 1, 1, 1])
    expect(zoneTotal(s, 'p0z0')).toBe(4)
  })

  it('#12 双翼×2（両ゾーン）+ 3枚目の双翼 → 3枚すべて 3', () => {
    const s = makeState({ p0z0: ['soyoku', 'soyoku'], p0z1: ['soyoku'] })
    expect(valuesInOrder(s, 'p0z0')).toEqual([3, 3])
    expect(valuesInOrder(s, 'p0z1')).toEqual([3])
    expect(zoneTotal(s, 'p0z0')).toBe(6)
    expect(zoneTotal(s, 'p0z1')).toBe(3)
  })
})

describe('層の優先順位', () => {
  it('断崖が4枚未満なら本来の3のまま（自己条件の境界）', () => {
    expect(zoneTotal(makeState({ p0z0: ['dangai'] }), 'p0z0')).toBe(3)
    expect(zoneTotal(makeState({ p0z0: ['dangai', 'heigen'] }), 'p0z0')).toBe(4)
  })

  it('足枷は4枚以下なら -2 のまま（自己条件の境界）', () => {
    const s = makeState({ p0z0: ['ashikase', 'heigen', 'heigen', 'hanmo'] })
    expect(valuesInOrder(s, 'p0z0')).toEqual([-2, 1, 1, 1])
    expect(zoneTotal(s, 'p0z0')).toBe(1)
  })

  it('陽炎 > 洞穴 > 月光：3層すべて同居しても陽炎が勝つ（3+0+0）', () => {
    const s = makeState({ p0z0: ['kagero', 'horaana', 'gekko'] })
    expect(valuesInOrder(s, 'p0z0')).toEqual([3, 0, 0])
    expect(zoneTotal(s, 'p0z0')).toBe(3)
  })

  it('洞穴 > 月光：洞穴があれば月光が何枚あっても合計5', () => {
    expect(zoneTotal(makeState({ p0z0: ['horaana', 'gekko', 'dangai'] }), 'p0z0')).toBe(5)
  })

  it('陽炎が同ゾーンに複数あっても効果は変わらない', () => {
    const s = makeState({ p0z0: ['kagero', 'kagero', 'dangai'] })
    expect(zoneTotal(s, 'p0z0')).toBe(9)
  })

  it('陽炎はそのゾーンにしか効かない（別ゾーンの変動は止めない）', () => {
    const s = makeState({ p0z0: ['kagero', 'dangai', 'heigen'], p0z1: ['dangai', 'heigen', 'hanmo'] })
    expect(zoneTotal(s, 'p0z0')).toBe(7) // 3+3+1、断崖は3枚でも陽炎で0にならない
    expect(zoneTotal(s, 'p0z1')).toBe(2) // 0+1+1、こちらは断崖が0になる
  })

  it('常在効果：陽炎が離れれば無効化も解除される', () => {
    const withKagero = makeState({ p0z0: ['kagero', 'gekko', 'dangai'] })
    const without = makeState({ p0z0: ['gekko', 'dangai'] })
    expect(zoneTotal(withKagero, 'p0z0')).toBe(6)
    expect(zoneTotal(without, 'p0z0')).toBe(0)
  })
})

describe('双翼の成立判定（持ち主単位）', () => {
  it('相手ゾーンに置いた双翼は相手の成立を手伝ってしまう', () => {
    // p0 が p1 のゾーンに双翼を置いた形。持ち主基準なので p1 側が成立する
    const s = makeState({ p0z0: ['soyoku'], p1z0: ['soyoku'], p1z1: ['soyoku'] })
    expect(valuesInOrder(s, 'p0z0')).toEqual([1]) // p0 は片ゾーンだけなので不成立
    expect(valuesInOrder(s, 'p1z0')).toEqual([3])
    expect(valuesInOrder(s, 'p1z1')).toEqual([3])
  })

  it('相手の双翼はこちらの成立判定に影響しない', () => {
    const s = makeState({ p0z0: ['soyoku'], p1z1: ['soyoku'] })
    expect(valuesInOrder(s, 'p0z0')).toEqual([1])
    expect(valuesInOrder(s, 'p1z1')).toEqual([1])
  })
})

describe('zoneTotal / score', () => {
  it('空ゾーンの合計は 0', () => {
    expect(zoneTotal(makeState({}), 'p0z0')).toBe(0)
  })

  it('得点は2ゾーンの積', () => {
    const s = makeState({ p0z0: ['kagero'], p0z1: ['dangai', 'heigen'] })
    expect(zoneTotal(s, 'p0z0')).toBe(3)
    expect(zoneTotal(s, 'p0z1')).toBe(4)
    expect(score(s, 0)).toBe(12)
  })

  it('片方のゾーンが0なら総得点0', () => {
    const s = makeState({ p0z0: ['gekko', 'dangai'], p0z1: ['kagero'] })
    expect(score(s, 0)).toBe(0)
  })

  it('両ゾーンともマイナスなら積は正（正典 §5、将来のカード追加向け）', () => {
    const s = makeState({ p0z0: ['ashikase'], p0z1: ['ashikase'] })
    expect(zoneTotal(s, 'p0z0')).toBe(-2)
    expect(zoneTotal(s, 'p0z1')).toBe(-2)
    expect(score(s, 0)).toBe(4)
  })

  it('プレイヤーごとに独立して集計される', () => {
    const s = makeState({
      p0z0: ['dangai'],
      p0z1: ['dangai'],
      p1z0: ['heigen'],
      p1z1: ['heigen', 'hanmo'],
    })
    expect(score(s, 0)).toBe(9)
    expect(score(s, 1)).toBe(2)
  })
})

describe('純粋性', () => {
  it('cardValues / zoneTotal / score は state を変更しない', () => {
    const s = makeState({ p0z0: ['kagero', 'gekko', 'dangai'], p0z1: ['soyoku'] })
    const before = JSON.stringify(s)
    cardValues(s, 'p0z0')
    zoneTotal(s, 'p0z0')
    score(s, 0)
    expect(JSON.stringify(s)).toBe(before)
  })

  it('同じ盤面なら何度呼んでも同じ結果（キャッシュに依存しない）', () => {
    const s = makeState({ p0z0: ['horaana', 'gekko'], p0z1: ['dangai', 'heigen', 'hanmo'] })
    expect(zoneTotal(s, 'p0z0')).toBe(zoneTotal(s, 'p0z0'))
    expect(score(s, 0)).toBe(score(s, 0))
  })
})
