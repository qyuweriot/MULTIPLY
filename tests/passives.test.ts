// 常在効果の状態判定。docs/カード効果テキスト.md の層構造
//（陽炎3 → 洞穴2 → 月光1 → 自己条件0）の裏返しなので、ここは厚く書く。
//
// ★ すべての判定を value.ts の実際の数値と突き合わせる。
//   「発動中と表示しているのに数値が変わっていない」「無効と表示しているのに
//   効いている」というズレを、表示側だけで作れないようにするため。
import { describe, expect, it } from 'vitest'
import type { CardId, GameState, ZoneKey } from '../src/core/types.ts'
import { cardValues, zoneTotal } from '../src/core/value.ts'
import { passiveStatus, valueNote, zoneBadges } from '../src/ui/passives.ts'
import { makeState } from './helpers.ts'

/** ゾーンの n 番目のカードの状態 */
function statusOf(state: GameState, key: ZoneKey, index: number) {
  return passiveStatus(state, key, state.zones[key].cards[index])
}

/** そのゾーンで defId のカードを探して状態を返す */
function statusOfCard(state: GameState, key: ZoneKey, defId: CardId) {
  const card = state.zones[key].cards.find((c) => c.defId === defId)
  if (card === undefined) throw new Error(`${defId} が ${key} にない`)
  return { status: passiveStatus(state, key, card), value: cardValues(state, key).get(card.uid) }
}

describe('陽炎（層1）', () => {
  it('止める効果があれば発動中', () => {
    // 月光がいなければ断崖は3。月光がいれば0。陽炎はそれを止める
    const s = makeState({ p0z0: ['kagero', 'gekko', 'dangai'] })
    expect(statusOfCard(s, 'p0z0', 'kagero').status.state).toBe('active')
    // 実際に止まっている：断崖は本来の3のまま
    expect(statusOfCard(s, 'p0z0', 'dangai').value).toBe(3)
  })

  it('止めるものが無ければ条件未達', () => {
    const s = makeState({ p0z0: ['kagero', 'shiso'] })
    expect(statusOfCard(s, 'p0z0', 'kagero').status.state).toBe('dormant')
    // 数値は誰も動かしていない
    expect(cardValues(s, 'p0z0').get(s.zones.p0z0.cards[1].uid)).toBe(3)
  })

  it('枚数条件（断崖3枚）を止めている場合も発動中になる', () => {
    // 陽炎・断崖・平原の3枚。陽炎が無ければ断崖は0になる
    const s = makeState({ p0z0: ['kagero', 'dangai', 'heigen'] })
    expect(s.zones.p0z0.cards).toHaveLength(3)
    expect(statusOfCard(s, 'p0z0', 'kagero').status.state).toBe('active')
    expect(statusOfCard(s, 'p0z0', 'dangai').value).toBe(3) // 0 になっていない
  })

  it('陽炎を刺創に差し替えても枚数は変わらない（差し替え方式の前提）', () => {
    // 差し替えで枚数が減ると、断崖の3枚条件が崩れて判定を誤る
    const s = makeState({ p0z0: ['kagero', 'dangai', 'heigen'] })
    const withShiso = makeState({ p0z0: ['shiso', 'dangai', 'heigen'] })
    expect(withShiso.zones.p0z0.cards).toHaveLength(s.zones.p0z0.cards.length)
    // 刺創は盤面では何もしないので、断崖は枚数条件どおり0になる
    expect(cardValues(withShiso, 'p0z0').get(withShiso.zones.p0z0.cards[1].uid)).toBe(0)
  })
})

describe('洞穴（層2）', () => {
  it('陽炎がなければ発動中で、合計が5になっている', () => {
    const s = makeState({ p0z0: ['horaana', 'dangai'] })
    expect(statusOfCard(s, 'p0z0', 'horaana').status.state).toBe('active')
    expect(zoneTotal(s, 'p0z0')).toBe(5)
  })

  it('陽炎があれば無効で、合計は5にならない', () => {
    const s = makeState({ p0z0: ['kagero', 'horaana', 'dangai'] })
    const { status } = statusOfCard(s, 'p0z0', 'horaana')
    expect(status.state).toBe('negated')
    expect(status.reason).toContain('陽炎')
    expect(zoneTotal(s, 'p0z0')).not.toBe(5) // 3 + 0 + 3
  })
})

describe('月光（層3）', () => {
  it('上の層がなければ発動中で、数値が書き換わっている', () => {
    const s = makeState({ p0z0: ['gekko', 'heigen', 'dangai'] })
    expect(statusOfCard(s, 'p0z0', 'gekko').status.state).toBe('active')
    expect(statusOfCard(s, 'p0z0', 'heigen').value).toBe(3) // 本来1 → 3
    expect(statusOfCard(s, 'p0z0', 'dangai').value).toBe(0) // 本来3 → 0
  })

  it('陽炎に潰される', () => {
    const s = makeState({ p0z0: ['kagero', 'gekko', 'heigen'] })
    const { status } = statusOfCard(s, 'p0z0', 'gekko')
    expect(status.state).toBe('negated')
    expect(status.reason).toContain('陽炎')
    expect(statusOfCard(s, 'p0z0', 'heigen').value).toBe(1) // 3 になっていない
  })

  it('洞穴に潰される（合計が上書きされるので個別値は意味を持たない）', () => {
    const s = makeState({ p0z0: ['horaana', 'gekko', 'heigen'] })
    const { status } = statusOfCard(s, 'p0z0', 'gekko')
    expect(status.state).toBe('negated')
    expect(status.reason).toContain('洞穴')
    expect(zoneTotal(s, 'p0z0')).toBe(5)
  })
})

describe('双翼（自己条件）', () => {
  it('両ゾーンに揃えば発動中で、数値が3になっている', () => {
    const s = makeState({ p0z0: ['soyoku'], p0z1: ['soyoku'] })
    const { status, value } = statusOfCard(s, 'p0z0', 'soyoku')
    expect(status.state).toBe('active')
    expect(value).toBe(3)
  })

  it('片方だけなら条件未達で、数値は本来の1のまま', () => {
    const s = makeState({ p0z0: ['soyoku'] })
    const { status, value } = statusOfCard(s, 'p0z0', 'soyoku')
    expect(status.state).toBe('dormant')
    expect(status.reason).toContain('片翼')
    expect(value).toBe(1)
  })

  it('成立していても陽炎のあるゾーンでは無効（味方の強化も止まる）', () => {
    const s = makeState({ p0z0: ['soyoku', 'kagero'], p0z1: ['soyoku'] })
    const { status, value } = statusOfCard(s, 'p0z0', 'soyoku')
    expect(status.state).toBe('negated')
    expect(value).toBe(1)
    // 陽炎のない側は成立したまま
    expect(statusOfCard(s, 'p0z1', 'soyoku').value).toBe(3)
  })

  it('相手のゾーンとは組にならない', () => {
    const s = makeState({ p0z0: ['soyoku'], p1z0: ['soyoku'] })
    expect(statusOfCard(s, 'p0z0', 'soyoku').status.state).toBe('dormant')
  })
})

describe('断崖・足枷（枚数の自己条件）', () => {
  it('断崖は3枚以上で発動中', () => {
    const s = makeState({ p0z0: ['dangai', 'heigen', 'hanmo'] })
    const { status, value } = statusOfCard(s, 'p0z0', 'dangai')
    expect(status.state).toBe('active')
    expect(value).toBe(0)
  })

  it('断崖は2枚だと条件未達で、あと何枚かを言う', () => {
    const s = makeState({ p0z0: ['dangai', 'heigen'] })
    const { status, value } = statusOfCard(s, 'p0z0', 'dangai')
    expect(status.state).toBe('dormant')
    expect(status.reason).toContain('あと1枚')
    expect(value).toBe(3)
  })

  it('足枷は5枚以上で発動中、4枚では条件未達', () => {
    const four: CardId[] = ['ashikase', 'heigen', 'heigen', 'hanmo']
    const s4 = makeState({ p0z0: four })
    expect(statusOfCard(s4, 'p0z0', 'ashikase').status.state).toBe('dormant')
    expect(statusOfCard(s4, 'p0z0', 'ashikase').value).toBe(-2)

    const s5 = makeState({ p0z0: [...four, 'hanmo'] })
    expect(statusOfCard(s5, 'p0z0', 'ashikase').status.state).toBe('active')
    expect(statusOfCard(s5, 'p0z0', 'ashikase').value).toBe(0)
  })

  it('条件を満たしていても、陽炎があれば無効', () => {
    const s = makeState({ p0z0: ['dangai', 'heigen', 'kagero'] })
    const { status, value } = statusOfCard(s, 'p0z0', 'dangai')
    expect(status.state).toBe('negated')
    expect(status.reason).toContain('陽炎')
    expect(value).toBe(3) // 0 になっていない
  })

  it('月光があれば、数値を決めているのは月光なので無効', () => {
    const s = makeState({ p0z0: ['dangai', 'heigen', 'gekko'] })
    expect(statusOfCard(s, 'p0z0', 'dangai').status.state).toBe('negated')
    expect(statusOfCard(s, 'p0z0', 'dangai').status.reason).toContain('月光')
  })
})

describe('氷山と、常在を持たないカード', () => {
  it('氷山はつねに発動中（陽炎の影響を受けない）', () => {
    const s = makeState({ p0z0: ['hyozan', 'kagero'] })
    expect(statusOfCard(s, 'p0z0', 'hyozan').status.state).toBe('active')
  })

  it('設置時効果のカードは盤面では状態を持たない', () => {
    const s = makeState({ p0z0: ['shiso', 'uzushio', 'shippu', 'heigen', 'hanmo'] })
    for (let i = 0; i < 5; i++) {
      expect(statusOf(s, 'p0z0', i).state).toBe('none')
    }
  })
})

describe('ゾーンのバッジ', () => {
  it('ゾーン全体に効くカードだけが並ぶ', () => {
    const s = makeState({ p0z0: ['kagero', 'gekko', 'horaana', 'hyozan', 'dangai'] })
    const ids = zoneBadges(s, 'p0z0', false).map((b) => b.id)
    // 断崖は自分の数値だけの話なのでバッジにしない
    expect(ids).toEqual(['kagero', 'gekko', 'horaana', 'hyozan'])
  })

  it('無効化されているものは打ち消しの印が付く', () => {
    const s = makeState({ p0z0: ['kagero', 'gekko', 'horaana'] })
    const badges = zoneBadges(s, 'p0z0', false)
    expect(badges.find((b) => b.id === 'kagero')?.negated).toBe(false)
    expect(badges.find((b) => b.id === 'gekko')?.negated).toBe(true)
    expect(badges.find((b) => b.id === 'horaana')?.negated).toBe(true)
  })

  it('月光にもバッジが出る（以前は月光だけ表示が無かった）', () => {
    const s = makeState({ p0z0: ['gekko'] })
    expect(zoneBadges(s, 'p0z0', false).map((b) => b.text)).toEqual(['月光：1は3・他は0'])
  })

  it('繁茂の強制は呼び出し側から渡す（盤面の状態ではなく手番の話なので）', () => {
    const s = makeState({})
    expect(zoneBadges(s, 'p0z0', true)[0].id).toBe('forced')
    expect(zoneBadges(s, 'p0z0', false)).toEqual([])
  })

  it('同名カードが2枚あってもバッジは1つ', () => {
    const s = makeState({ p0z0: ['hyozan', 'hyozan'] })
    expect(zoneBadges(s, 'p0z0', false)).toHaveLength(1)
  })

  it('条件未達のカードはバッジを出さない', () => {
    const s = makeState({ p0z0: ['kagero'] }) // 止めるものが無い＝dormant
    expect(zoneBadges(s, 'p0z0', false)).toEqual([])
  })
})

describe('現在値の説明', () => {
  it('変動していなければ数値だけ', () => {
    const s = makeState({ p0z0: ['dangai'] })
    expect(valueNote(s, 'p0z0', s.zones.p0z0.cards[0])).toBe('数値 3')
  })

  it('変動していれば本来値からの矢印で出す', () => {
    const s = makeState({ p0z0: ['gekko', 'dangai'] })
    expect(valueNote(s, 'p0z0', s.zones.p0z0.cards[1])).toBe('数値 3 → 0')
  })
})
