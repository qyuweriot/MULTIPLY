// 表示名はここに集約する。内部識別子（p0z0 / p0z1 / p1z0 / p1z1）は変更しない。
//
// 効果テキストはゾーン固有名を一切使わない設計なので（正典 §1）、呼称の変更は
// この表示層だけで完結する。
import type { ZoneKey } from './core/types.ts'
import { ownerOf, slotOf } from './core/types.ts'

/** [先攻の呼称, 後攻の呼称] */
export type PlayerLabels = readonly [string, string]

/** 人間同士（ホットシート） */
const HOTSEAT: PlayerLabels = ['Player1', 'Player2']

/** CPU 戦。CPU が受け持つのは後攻（App.tsx の CPU_PLAYER = 1） */
const VS_CPU: PlayerLabels = ['Player', 'CPU']

/**
 * 対戦相手に応じたプレイヤーの呼称。
 *
 * 静的な定数にしないのは、CPU 戦では「Player2」ではなく「CPU」と呼びたいから。
 * 呼び出し側がモードを渡し忘れられないよう、定数の直接公開はしない。
 */
export function playerLabels(vsCpu: boolean): PlayerLabels {
  return vsCpu ? VS_CPU : HOTSEAT
}

export const ZONE_LABELS = { z0: 'L', z1: 'R' } as const

export const DIFFICULTY_LABELS = {
  easy: 'CPU（易）',
  normal: 'CPU（普通）',
  hard: 'CPU（強）',
} as const

/** 「Player2-R」のような、持ち主つきのゾーン名 */
export function zoneName(key: ZoneKey, labels: PlayerLabels): string {
  return `${labels[ownerOf(key)]}-${ZONE_LABELS[slotOf(key)]}`
}
