// 表示名はここに集約する。ゾーン呼称は未確定なので Phase 8 でこの1行を差し替える。
// 内部識別子（p0z0 / p0z1 / p1z0 / p1z1）は変更しない。
import type { ZoneKey } from './core/types.ts'
import { ownerOf, slotOf } from './core/types.ts'

export const ZONE_LABELS = { z0: '第一', z1: '第二' } as const

export const PLAYER_LABELS = ['プレイヤー1', 'プレイヤー2'] as const

export const DIFFICULTY_LABELS = {
  easy: 'CPU（易）',
  normal: 'CPU（普通）',
  hard: 'CPU（強）',
} as const

/** 「プレイヤー1・第一」のような、持ち主つきのゾーン名 */
export function zoneName(key: ZoneKey): string {
  return `${PLAYER_LABELS[ownerOf(key)]}・${ZONE_LABELS[slotOf(key)]}`
}
