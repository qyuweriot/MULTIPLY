// 氷山によるゾーンの設置制限。
//
// 「このゾーンには、本来の数値が2のカードしか置くことができない。」
// 判定に必要なのは「このゾーンに氷山があるか」だけなので、枚数を数える状態は持たない。
//
// 作業計画書 §6 のサンプルは zone を破壊的に書き換えるシグネチャだが、§1-1 の
// 「immutable な更新を徹底する」を優先し、新しい ZoneState を返す純関数にしてある。
// CPU の先読みが applyMove の繰り返しで成立する前提なので、ここは妥協しない。
import { base } from './cards.ts'
import type { CardInstance, ZoneState } from './types.ts'

/** 氷山が通す本来の数値 */
export const HYOZAN_ALLOWED_VALUE = 2

/** カードがゾーンに入る（設置でも渦潮の移動でも通る） */
export function onEnter(zone: ZoneState, card: CardInstance): ZoneState {
  return { cards: [...zone.cards, card] }
}

/** カードがゾーンを離れる（刺創で捨てられた／渦潮で移動した） */
export function onLeave(zone: ZoneState, card: CardInstance): ZoneState {
  return { cards: zone.cards.filter((c) => c.uid !== card.uid) }
}

/**
 * 氷山が張っているゾーンか。
 * 氷山が離れれば制限も消える。別の氷山が残っていれば維持される。
 */
export function isRestricted(zone: ZoneState): boolean {
  return zone.cards.some((c) => c.defId === 'hyozan')
}

/**
 * そのカードをこのゾーンに置けるか。
 * 数値は正典 §2 に従い **本来の数値** で判定する（効果で変動した後の値ではない）。
 * 氷山自身も本来の数値が2なので、氷山のあるゾーンに氷山を重ねられる。
 */
export function canPlace(zone: ZoneState, card: CardInstance): boolean {
  return !isRestricted(zone) || base(card) === HYOZAN_ALLOWED_VALUE
}
