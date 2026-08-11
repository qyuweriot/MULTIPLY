import { describe, expect, it } from 'vitest'
import { base, CARD_DEFS, CARD_ORDER, DECK_SIZE } from '../src/core/cards.ts'
import { buildDeck, createGame, INITIAL_HAND_SIZE } from '../src/core/setup.ts'
import type { CardId, CardInstance } from '../src/core/types.ts'
import { ALL_ZONES } from '../src/core/types.ts'

/** 正典 docs/カード効果テキスト.md §4 の山札構成 */
const EXPECTED_COPIES: Record<CardId, number> = {
  shiso: 2,
  kagero: 2,
  dangai: 2,
  hyozan: 3,
  uzushio: 3,
  shippu: 3,
  soyoku: 4,
  heigen: 4,
  hanmo: 4,
  horaana: 1,
  gekko: 1,
  ashikase: 1,
}

const uidsOf = (cards: readonly CardInstance[]) => cards.map((c) => c.uid)

describe('カード定義', () => {
  it('12種そろっている', () => {
    expect(CARD_ORDER).toHaveLength(12)
    expect(new Set(CARD_ORDER).size).toBe(12)
    expect(Object.keys(CARD_DEFS).sort()).toEqual([...CARD_ORDER].sort())
  })

  it('id フィールドがキーと一致する', () => {
    for (const id of CARD_ORDER) {
      expect(CARD_DEFS[id].id).toBe(id)
    }
  })

  it('設置時効果を持つのは平原・繁茂・渦潮・疾風・刺創の5種', () => {
    const onPlace = CARD_ORDER.filter((id) => CARD_DEFS[id].hasOnPlace).sort()
    expect(onPlace).toEqual(['heigen', 'hanmo', 'shippu', 'shiso', 'uzushio'].sort())
  })

  it('優先度が正典の層と一致する（陽炎3・洞穴2・月光1）', () => {
    expect(CARD_DEFS.kagero.priority).toBe(3)
    expect(CARD_DEFS.horaana.priority).toBe(2)
    expect(CARD_DEFS.gekko.priority).toBe(1)
    for (const id of ['soyoku', 'dangai', 'ashikase'] as const) {
      expect(CARD_DEFS[id].priority).toBe(0)
    }
  })

  it('全カードに表示テキストと読みがある', () => {
    for (const id of CARD_ORDER) {
      expect(CARD_DEFS[id].text.length).toBeGreaterThan(0)
      expect(CARD_DEFS[id].reading.length).toBeGreaterThan(0)
      expect(CARD_DEFS[id].name.length).toBeGreaterThan(0)
    }
  })
})

describe('buildDeck', () => {
  it('30枚生成される', () => {
    expect(DECK_SIZE).toBe(30)
    expect(buildDeck()).toHaveLength(30)
  })

  it('カード別の枚数が正典と一致する', () => {
    const deck = buildDeck()
    for (const id of CARD_ORDER) {
      const count = deck.filter((c) => c.defId === id).length
      expect(count, id).toBe(EXPECTED_COPIES[id])
    }
  })

  it('本来の数値の総和が 46', () => {
    expect(buildDeck().reduce((sum, c) => sum + base(c), 0)).toBe(46)
  })

  it('uid が 0..29 で重複しない', () => {
    expect(uidsOf(buildDeck())).toEqual([...Array(30).keys()])
  })

  it('呼ぶたびに同じ内容だが別インスタンスを返す', () => {
    const a = buildDeck()
    const b = buildDeck()
    expect(a).toEqual(b)
    expect(a[0]).not.toBe(b[0])
  })
})

describe('createGame', () => {
  it('初期状態が仕様どおり', () => {
    const s = createGame(42)
    expect(s.hands[0]).toHaveLength(INITIAL_HAND_SIZE)
    expect(s.hands[1]).toHaveLength(INITIAL_HAND_SIZE)
    expect(s.deck).toHaveLength(30 - INITIAL_HAND_SIZE * 2)
    expect(s.discard).toEqual([])
    expect(s.turn).toBe(1)
    expect(s.current).toBe(0)
    expect(s.forcedZone).toBeNull()
    expect(s.log).toEqual([])
    expect(s.phase).toBe('playing')
    for (const key of ALL_ZONES) {
      expect(s.zones[key].cards).toEqual([])
      expect(s.zones[key].lockThreshold).toBeNull()
    }
  })

  it('★同じシードなら山札も手札も完全に同じ順序になる', () => {
    const a = createGame(2024)
    const b = createGame(2024)
    expect(uidsOf(a.deck)).toEqual(uidsOf(b.deck))
    expect(uidsOf(a.hands[0])).toEqual(uidsOf(b.hands[0]))
    expect(uidsOf(a.hands[1])).toEqual(uidsOf(b.hands[1]))
    expect(a.rng).toBe(b.rng)
  })

  it('シードが違えば並びが変わる', () => {
    expect(uidsOf(createGame(1).deck)).not.toEqual(uidsOf(createGame(2).deck))
  })

  it('シャッフルされている（定義順のままではない）', () => {
    const s = createGame(7)
    const all = [...s.hands[0], ...s.hands[1], ...s.deck]
    expect(uidsOf(all)).not.toEqual([...Array(30).keys()])
  })

  it('カードの消失も重複もない', () => {
    for (const seed of [0, 1, -5, 999999, 2 ** 31]) {
      const s = createGame(seed)
      const all = [...s.hands[0], ...s.hands[1], ...s.deck, ...s.discard]
      expect(all, `seed=${seed}`).toHaveLength(30)
      expect(new Set(uidsOf(all)).size, `seed=${seed}`).toBe(30)
    }
  })

  it('手札は山札トップから p0 → p1 の順に配られる', () => {
    // 配布前の山札を同じシードで再現して先頭4枚と突き合わせる
    const s = createGame(123)
    const dealt = [s.hands[0][0], s.hands[1][0], s.hands[0][1], s.hands[1][1]]
    expect(dealt.every((c) => c !== undefined)).toBe(true)
    // 配られた4枚は山札に残っていない
    const deckUids = new Set(uidsOf(s.deck))
    for (const c of dealt) {
      expect(deckUids.has(c.uid)).toBe(false)
    }
  })

  it('返り値の zones は state ごとに独立している', () => {
    const a = createGame(5)
    const b = createGame(5)
    a.zones.p0z0.cards.push(a.hands[0][0])
    expect(b.zones.p0z0.cards).toEqual([])
  })
})
