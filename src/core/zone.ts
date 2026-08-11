// 氷山によるゾーンロックの管理。
//
// 作業計画書 §6 のサンプルは zone を破壊的に書き換えるシグネチャだが、§1-1 の
// 「immutable な更新を徹底する」を優先し、新しい ZoneState を返す純関数にしてある。
// CPU の先読みが applyMove の繰り返しで成立する前提なので、ここは妥協しない。
import type { CardInstance, ZoneState } from './types.ts'

/** カードがゾーンに入る（設置でも渦潮の移動でも通る） */
export function onEnter(zone: ZoneState, card: CardInstance): ZoneState {
  const cards = [...zone.cards, card]
  return {
    cards,
    // 氷山が入った時点で「あと1枚」に再設定する。
    // 同ゾーンに2枚目が入った場合もここでリセットされる。
    lockThreshold: card.defId === 'hyozan' ? cards.length + 1 : zone.lockThreshold,
  }
}

/** カードがゾーンを離れる（刺創で捨てられた／渦潮で移動した） */
export function onLeave(zone: ZoneState, card: CardInstance): ZoneState {
  const cards = zone.cards.filter((c) => c.uid !== card.uid)
  // 離れたのが氷山で、かつゾーンに氷山が1枚も残っていない場合のみ解除する。
  // 他の氷山が残っているなら既存の制限をそのまま維持する。
  const unlocked = card.defId === 'hyozan' && !cards.some((c) => c.defId === 'hyozan')
  return {
    cards,
    lockThreshold: unlocked ? null : zone.lockThreshold,
  }
}

export function isFull(zone: ZoneState): boolean {
  return zone.lockThreshold !== null && zone.cards.length >= zone.lockThreshold
}

export function canAccept(zone: ZoneState): boolean {
  return !isFull(zone)
}
