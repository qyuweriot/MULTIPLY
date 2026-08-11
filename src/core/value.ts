// 数値計算エンジン。このゲームの心臓部。
//
// 優先度は数字が大きいものから先に処理し、**先の層で確定した値は後の層で上書きしない**。
//
//   層1（優先度3）陽炎   数値変動の禁止
//   層2（優先度2）洞穴   ゾーン合計値の上書き
//   層3（優先度1）月光   ゾーン内カードの数値の一括書き換え
//   層4（優先度0）双翼・断崖・足枷   カード個別の自己条件
//
// キャッシュはしない。盤面が変わるたびに全層を再計算する（正典 §2）。
// 差分更新は不整合の温床になるので禁止。カードは最大14枚なので性能問題は起きない。
import { base } from './cards.ts'
import type { CardId, GameState, PlayerId, ZoneKey } from './types.ts'
import { ownerOf, zonesOf } from './types.ts'

/** ゾーン内の各カードの現在値（uid → 数値） */
export function cardValues(state: GameState, key: ZoneKey): Map<number, number> {
  const zone = state.zones[key]
  const has = (id: CardId) => zone.cards.some((c) => c.defId === id)
  const out = new Map<number, number>()

  // 層1：陽炎。すべての数値変動を無効化する → 本来の数値をそのまま返す
  if (has('kagero')) {
    for (const c of zone.cards) out.set(c.uid, base(c))
    return out
  }

  // 層2：洞穴。合計値を上書きするため個別値は意味を持たない
  //   → 合計は zoneTotal 側で 5 に固定する。ここでは本来の数値を入れておく
  if (has('horaana')) {
    for (const c of zone.cards) out.set(c.uid, base(c))
    return out
  }

  // 層3：月光。本来の数値が1なら3、それ以外は0。値はここで確定する
  if (has('gekko')) {
    for (const c of zone.cards) out.set(c.uid, base(c) === 1 ? 3 : 0)
    return out // 確定済みなので層4は処理しない
  }

  // 層4：カード個別の自己条件
  const n = zone.cards.length
  const paired = soyokuPaired(state, ownerOf(key))
  for (const c of zone.cards) {
    let v = base(c)
    if (c.defId === 'soyoku' && paired) v = 3
    if (c.defId === 'dangai' && n >= 3) v = 0
    if (c.defId === 'ashikase' && n >= 5) v = 0
    out.set(c.uid, v)
  }
  return out
}

export function zoneTotal(state: GameState, key: ZoneKey): number {
  const zone = state.zones[key]
  const has = (id: CardId) => zone.cards.some((c) => c.defId === id)

  // 層2：陽炎がなければ洞穴が合計を5に固定する
  if (!has('kagero') && has('horaana')) return 5

  let total = 0
  for (const v of cardValues(state, key).values()) total += v
  return total
}

/**
 * 双翼の成立判定：持ち主の2ゾーン両方に双翼が「存在するか」。
 * 陽炎は数値変動を止めるだけで存在を隠さないので、陽炎のあるゾーンの双翼も数える。
 */
function soyokuPaired(state: GameState, owner: PlayerId): boolean {
  return zonesOf(owner).every((key) => state.zones[key].cards.some((c) => c.defId === 'soyoku'))
}

/** 得点＝2つのゾーンの合計数値の積 */
export function score(state: GameState, p: PlayerId): number {
  const [z0, z1] = zonesOf(p)
  return zoneTotal(state, z0) * zoneTotal(state, z1)
}
