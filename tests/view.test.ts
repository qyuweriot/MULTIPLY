// CPU 向け情報制限ビュー。作業計画書 §1-4「CPUに山札の中身を見せない」の検証。
import { describe, expect, it } from 'vitest'
import { visibleTo } from '../src/ai/view.ts'
import { CARD_DEFS } from '../src/core/cards.ts'
import { shuffle, seedFrom } from '../src/core/rng.ts'
import { createGame } from '../src/core/setup.ts'
import type { GameState } from '../src/core/types.ts'
import { allCardUids, makeState, withHand } from './helpers.ts'

const uids = (cs: readonly { uid: number }[]) => cs.map((c) => c.uid)

describe('★山札の順序を見せない', () => {
  it('山札の並びだけが違う2つの盤面から、まったく同じビューが得られる', () => {
    const base = createGame(42)
    // 同じ中身のまま山札を並べ替える
    const [reordered] = shuffle(base.deck, seedFrom(999))
    const other: GameState = { ...base, deck: reordered }

    expect(uids(other.deck)).not.toEqual(uids(base.deck)) // 前提：並びは違う

    const a = visibleTo(base, 0)
    const b = visibleTo(other, 0)
    expect(uids(a.state.deck)).toEqual(uids(b.state.deck))
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state))
  })

  it('どんな並べ替えでもビューは一定（20通り）', () => {
    const base = createGame(7)
    const canonical = uids(visibleTo(base, 0).state.deck)
    for (let s = 0; s < 20; s++) {
      const [reordered] = shuffle(base.deck, seedFrom(s))
      expect(uids(visibleTo({ ...base, deck: reordered }, 0).state.deck)).toEqual(canonical)
    }
  })

  it('正規化後の山札はカードの定義順に並ぶ', () => {
    const view = visibleTo(createGame(3), 0)
    const values = view.state.deck.map((c) => CARD_DEFS[c.defId].baseValue)
    // CARD_ORDER は 刺創(3) → … → 足枷(-2) の順なので、数値は単調非増加になる
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThanOrEqual(values[i - 1])
    }
  })
})

describe('deckPool', () => {
  it('合計が山札枚数と一致する', () => {
    const s = createGame(11)
    const view = visibleTo(s, 0)
    const total = [...view.deckPool.values()].reduce((a, b) => a + b, 0)
    expect(total).toBe(s.deck.length)
  })

  it('内訳が実際の山札と一致する', () => {
    const s = createGame(5)
    const view = visibleTo(s, 0)
    for (const [id, count] of view.deckPool) {
      expect(s.deck.filter((c) => c.defId === id).length).toBe(count)
    }
  })

  it('山札が空なら空の内訳になる', () => {
    const s: GameState = { ...createGame(1), deck: [] }
    expect(visibleTo(s, 0).deckPool.size).toBe(0)
  })
})

describe('公開情報はそのまま見える', () => {
  it('手札・ゾーン・捨て札・ターン・強制ゾーンが保たれる', () => {
    const base = withHand(makeState({ p0z0: ['dangai'], p1z1: ['kagero'] }), ['gekko', 'shiso'])
    const s: GameState = { ...base, forcedZone: 'p1z0', turn: 9, discard: base.hands[1] }
    const view = visibleTo(s, 1)

    expect(view.me).toBe(1)
    expect(view.state.hands).toEqual(s.hands)
    expect(view.state.zones).toEqual(s.zones)
    expect(view.state.discard).toEqual(s.discard)
    expect(view.state.turn).toBe(9)
    expect(view.state.forcedZone).toBe('p1z0')
    expect(view.state.current).toBe(s.current)
  })

  it('相手の手札も見える（全公開情報のゲームなので）', () => {
    const s = createGame(2)
    expect(visibleTo(s, 0).state.hands[1]).toEqual(s.hands[1])
  })

  it('カード30枚の保存則が崩れない', () => {
    const s = createGame(4)
    const view = visibleTo(s, 0)
    expect(new Set(allCardUids(view.state)).size).toBe(30)
  })

  it('元の state を変更しない', () => {
    const s = createGame(6)
    const before = JSON.stringify(s)
    visibleTo(s, 0)
    expect(JSON.stringify(s)).toBe(before)
  })
})
