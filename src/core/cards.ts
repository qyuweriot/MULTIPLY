// カード定義データ（12種・計30枚）。docs/カード効果テキスト.md が正典。
// text は正典の【表示】文をそのまま入れてある（UI と説明書がこれを出す）。
import type { CardDef, CardId, CardInstance } from './types.ts'

export const CARD_DEFS: Record<CardId, CardDef> = {
  shiso: {
    id: 'shiso',
    name: '刺創',
    reading: 'しそう',
    baseValue: 3,
    priority: 0,
    hasOnPlace: true,
    copies: 2,
    text: 'このゾーンにあるカードを1枚選び、捨て札にする。',
  },
  kagero: {
    id: 'kagero',
    name: '陽炎',
    reading: 'かげろう',
    baseValue: 3,
    priority: 3,
    hasOnPlace: false,
    copies: 2,
    text: 'このゾーンでは、カードの数値および合計数値が、効果によって変化しない。',
  },
  dangai: {
    id: 'dangai',
    name: '断崖',
    reading: 'だんがい',
    baseValue: 3,
    priority: 0,
    hasOnPlace: false,
    copies: 2,
    text: 'このゾーンにカードが3枚以上あるなら、《断崖》の数値は0になる。',
  },
  hyozan: {
    id: 'hyozan',
    name: '氷山',
    reading: 'ひょうざん',
    baseValue: 2,
    // 氷山は数値変動ではなく設置制限なので、value.ts の層判定には関与しない。
    priority: 0,
    hasOnPlace: false,
    copies: 3,
    text: 'このゾーンには、本来の数値が2のカードしか置くことができない。',
  },
  uzushio: {
    id: 'uzushio',
    name: '渦潮',
    reading: 'うずしお',
    baseValue: 2,
    priority: 0,
    hasOnPlace: true,
    copies: 3,
    text: 'このゾーンにあるカードを1枚選び、別のゾーンへ移動させる。',
  },
  shippu: {
    id: 'shippu',
    name: '疾風',
    reading: 'しっぷう',
    baseValue: 2,
    priority: 0,
    hasOnPlace: true,
    copies: 3,
    text: '相手と手札をすべて交換する。',
  },
  soyoku: {
    id: 'soyoku',
    name: '双翼',
    reading: 'そうよく',
    baseValue: 1,
    priority: 0,
    hasOnPlace: false,
    copies: 4,
    text: '同じプレイヤーの2つのゾーンの両方に《双翼》があるなら、それらの《双翼》の数値は3になる。',
  },
  heigen: {
    id: 'heigen',
    name: '平原',
    reading: 'へいげん',
    baseValue: 1,
    priority: 0,
    hasOnPlace: true,
    copies: 4,
    text: '手札をすべて山札に戻してシャッフルし、その後2枚引く。',
  },
  hanmo: {
    id: 'hanmo',
    name: '繁茂',
    reading: 'はんも',
    baseValue: 1,
    priority: 0,
    hasOnPlace: true,
    copies: 4,
    text: '次の相手のターン、相手はこのゾーンにカードを置かなければならない。',
  },
  horaana: {
    id: 'horaana',
    name: '洞穴',
    reading: 'ほらあな',
    baseValue: 0,
    priority: 2,
    hasOnPlace: false,
    copies: 1,
    text: 'このゾーンの合計数値は5になる。',
  },
  gekko: {
    id: 'gekko',
    name: '月光',
    reading: 'げっこう',
    baseValue: 0,
    priority: 1,
    hasOnPlace: false,
    copies: 1,
    text: 'このゾーンにあるカードの数値を、本来の数値が1のカードは3、それ以外はすべて0として扱う。',
  },
  ashikase: {
    id: 'ashikase',
    name: '足枷',
    reading: 'あしかせ',
    baseValue: -2,
    priority: 0,
    hasOnPlace: false,
    copies: 1,
    text: 'このゾーンにカードが5枚以上あるなら、《足枷》の数値は0になる。',
  },
}

/** 山札に入る順序を安定させるための定義順（uid の採番順を決める） */
export const CARD_ORDER: readonly CardId[] = [
  'shiso',
  'kagero',
  'dangai',
  'hyozan',
  'uzushio',
  'shippu',
  'soyoku',
  'heigen',
  'hanmo',
  'horaana',
  'gekko',
  'ashikase',
]

export const ALL_CARD_DEFS: readonly CardDef[] = CARD_ORDER.map((id) => CARD_DEFS[id])

/** 山札の総枚数。ハードコードせず copies から算出する */
export const DECK_SIZE = ALL_CARD_DEFS.reduce((sum, def) => sum + def.copies, 0)

export function defOf(card: CardInstance): CardDef {
  return CARD_DEFS[card.defId]
}

/** 効果による変動前の「本来の数値」 */
export function base(card: CardInstance): number {
  return CARD_DEFS[card.defId].baseValue
}
