// 常在効果が「いま効いているのか」の判定。DOM にも React にも依存しない純関数。
//
// ★ 数値そのものは計算しない。答えは value.ts が持っている。
//   ここがやるのは「その値になった理由はどのカードか」を層構造から言い当てること。
//   優先度は正典どおり 陽炎3 → 洞穴2 → 月光1 → 自己条件0 の降順で、
//   先の層で確定した値は後の層で上書きされない。
//
// ★ 層の前後関係を見る knowledge がこのファイルに入るのは意図的。
//   表示のためだけの派生をコアへ持ち込むと、CPU の先読みが持ち回る状態が太る。
//   代わりに tests/passives.test.ts が、この判定と value.ts の実際の数値とを
//   一件ずつ突き合わせて固定している。
import { base } from '../core/cards.ts'
import type { CardId, CardInstance, GameState, ZoneKey } from '../core/types.ts'
import { ownerOf, zonesOf } from '../core/types.ts'
import { cardValues, zoneTotal } from '../core/value.ts'
import { HYOZAN_ALLOWED_VALUE, isRestricted } from '../core/zone.ts'

export type PassiveState = 'active' | 'negated' | 'dormant' | 'none'

export interface PassiveStatus {
  state: PassiveState
  /** ホバー詳細に出す一行。'none' のときは空 */
  reason: string
}

const NONE: PassiveStatus = { state: 'none', reason: '' }

/** 断崖が0になる枚数 */
const DANGAI_CARDS = 3
/** 足枷が0になる枚数 */
const ASHIKASE_CARDS = 5

/**
 * 陽炎の効果だけを消した仮想ゾーンを作るための差し替え先。
 *
 * 単に取り除くと枚数が減り、断崖（3枚）・足枷（5枚）の条件まで動いてしまう。
 * 刺創は設置時効果しか持たず盤面では何もせず、しかも**本来の数値が陽炎と同じ3**
 * なので、「効果だけを消して他は完全に据え置く」差し替えになる。
 */
const INERT: CardId = 'shiso'

function replaced(state: GameState, key: ZoneKey, uid: number, defId: CardId): GameState {
  const cards = state.zones[key].cards.map((c) => (c.uid === uid ? { uid: c.uid, defId } : c))
  return { ...state, zones: { ...state.zones, [key]: { cards } } }
}

/** 持ち主の2ゾーン両方に双翼があるか（value.ts の soyokuPaired と同じ条件） */
function soyokuPaired(state: GameState, key: ZoneKey): boolean {
  return zonesOf(ownerOf(key)).every((z) => state.zones[z].cards.some((c) => c.defId === 'soyoku'))
}

/**
 * そのカードの常在効果が、いまどうなっているか。
 *
 * @param key そのカードが置かれているゾーン
 */
export function passiveStatus(state: GameState, key: ZoneKey, card: CardInstance): PassiveStatus {
  const zone = state.zones[key]
  const has = (id: CardId) => zone.cards.some((c) => c.defId === id)
  const n = zone.cards.length

  switch (card.defId) {
    // 層1：陽炎。数値変動そのものを止める。
    // 「止めるものがあるか」は value.ts に答えさせる（陽炎を刺創に差し替えて比べる）
    case 'kagero': {
      const virtual = replaced(state, key, card.uid, INERT)
      const now = cardValues(state, key)
      const withoutKagero = cardValues(virtual, key)
      // 個別値だけでなく合計も見る。洞穴は cardValues ではなく zoneTotal のほうを
      // 5 に上書きするので、個別値の比較だけだと「陽炎が洞穴を止めている」を取り逃す
      const stops =
        zone.cards.some((c) => now.get(c.uid) !== withoutKagero.get(c.uid)) ||
        zoneTotal(state, key) !== zoneTotal(virtual, key)
      return stops
        ? { state: 'active', reason: 'このゾーンの数値変動を止めている' }
        : { state: 'dormant', reason: 'いま止めている効果はない' }
    }

    // 層2：洞穴。合計を5に上書きする
    case 'horaana':
      return has('kagero')
        ? { state: 'negated', reason: '陽炎により無効' }
        : { state: 'active', reason: `このゾーンの合計を ${zoneTotal(state, key)} に固定している` }

    // 層3：月光。本来1のカードを3、それ以外を0にする
    case 'gekko':
      if (has('kagero')) return { state: 'negated', reason: '陽炎により無効' }
      if (has('horaana')) return { state: 'negated', reason: '洞穴が合計を決めている' }
      return { state: 'active', reason: '本来1のカードを3、それ以外を0にしている' }

    // 層4：自己条件
    case 'soyoku': {
      if (!soyokuPaired(state, key)) {
        return { state: 'dormant', reason: '片翼のみ。もう一方のゾーンにも双翼が要る' }
      }
      // 成立しているのに3でないなら、上の層に潰されている
      const value = cardValues(state, key).get(card.uid)
      if (value === 3) return { state: 'active', reason: '両翼成立。数値が3になっている' }
      return { state: 'negated', reason: negatedBy(has) }
    }

    case 'dangai':
      return selfCondition(state, key, card, has, n, DANGAI_CARDS)

    case 'ashikase':
      return selfCondition(state, key, card, has, n, ASHIKASE_CARDS)

    // 氷山は数値変動ではなく設置制限なので、陽炎の影響を受けない
    case 'hyozan':
      return isRestricted(zone)
        ? { state: 'active', reason: `本来の数値が${HYOZAN_ALLOWED_VALUE}のカードしか置けない` }
        : NONE

    // 設置時効果のカードは、盤面に出たあとは何もしない
    default:
      return NONE
  }
}

/** 断崖・足枷：規定枚数に達したら自分の数値が0になる */
function selfCondition(
  state: GameState,
  key: ZoneKey,
  card: CardInstance,
  has: (id: CardId) => boolean,
  n: number,
  threshold: number,
): PassiveStatus {
  if (n < threshold) {
    return { state: 'dormant', reason: `あと${threshold - n}枚で数値が0になる` }
  }
  if (has('kagero') || has('horaana') || has('gekko')) {
    return { state: 'negated', reason: negatedBy(has) }
  }
  const value = cardValues(state, key).get(card.uid)
  return value === 0
    ? { state: 'active', reason: `${threshold}枚以上あるので数値が0になっている` }
    : // ここに来るのは層の判定と value.ts がズレたとき。テストで潰してある
      { state: 'negated', reason: '他の効果が数値を決めている' }
}

function negatedBy(has: (id: CardId) => boolean): string {
  if (has('kagero')) return '陽炎により無効'
  if (has('horaana')) return '洞穴が合計を決めている'
  if (has('gekko')) return '月光が数値を決めている'
  return '他の効果が数値を決めている'
}

export interface Badge {
  /** CSS の修飾子と React の key を兼ねる */
  id: string
  text: string
  /** 上の層に潰されている。打ち消し線で出す */
  negated: boolean
}

/**
 * ゾーンの上部に並べるバッジ。
 *
 * Zone.tsx にベタ書きすると「月光だけバッジが無い」「無効化されていても
 * 有効なものと同じ顔で出る」といった抜けが起きるので、ここに集約する。
 */
export function zoneBadges(state: GameState, key: ZoneKey, forced: boolean): Badge[] {
  const zone = state.zones[key]
  const out: Badge[] = []
  if (forced) out.push({ id: 'forced', text: '繁茂：ここに置く', negated: false })

  for (const card of zone.cards) {
    const status = passiveStatus(state, key, card)
    if (status.state === 'none' || status.state === 'dormant') continue
    const text = BADGE_TEXT[card.defId]
    if (text === undefined) continue
    // 同名カードが2枚あっても1つにまとめる
    if (out.some((b) => b.id === card.defId)) continue
    out.push({ id: card.defId, text, negated: status.state === 'negated' })
  }
  return out
}

/** ゾーン全体に効くカードだけがバッジを持つ（断崖・足枷・双翼は自分の数値だけの話） */
const BADGE_TEXT: Partial<Record<CardId, string>> = {
  kagero: '陽炎：効果無効',
  horaana: '洞穴：合計5固定',
  gekko: '月光：1は3・他は0',
  hyozan: `氷山：数値${HYOZAN_ALLOWED_VALUE}のみ`,
}

/** ホバー詳細に出す、そのカードの現在値の説明 */
export function valueNote(state: GameState, key: ZoneKey, card: CardInstance): string {
  const value = cardValues(state, key).get(card.uid)
  const original = base(card)
  if (value === undefined || value === original) return `数値 ${original}`
  return `数値 ${original} → ${value}`
}
