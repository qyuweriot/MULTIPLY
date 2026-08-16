// ゲームの型定義。DOM・React・ブラウザAPIには一切依存しない。
import type { RngState } from './rng.ts'

export type PlayerId = 0 | 1

/** ゾーンのスロット。表示名は src/labels.ts に集約してある */
export type ZoneSlot = 'z0' | 'z1'

/** ゾーンの内部識別子。表示名が決まってもここは変更しない */
export type ZoneKey = 'p0z0' | 'p0z1' | 'p1z0' | 'p1z1'

export const ALL_ZONES: readonly ZoneKey[] = ['p0z0', 'p0z1', 'p1z0', 'p1z1']

export type CardId =
  | 'gekko'
  | 'soyoku'
  | 'heigen'
  | 'hanmo'
  | 'hyozan'
  | 'uzushio'
  | 'shippu'
  | 'shiso'
  | 'kagero'
  | 'dangai'
  | 'ashikase'
  | 'horaana'

export interface CardDef {
  id: CardId
  /** '月光' */
  name: string
  /** 'げっこう' */
  reading: string
  /** 効果による変動前の「本来の数値」。洞穴は0、足枷は-2 */
  baseValue: number
  /**
   * 数値計算の層（大きいほど先に処理）。value.ts は層をカードIDで直接分岐するため
   * このフィールドは参照しない。表示・ドキュメント用のメタデータ。
   */
  priority: 0 | 1 | 2 | 3
  /** 設置時効果を持つか（平原・繁茂・渦潮・疾風・刺創） */
  hasOnPlace: boolean
  /** 山札に入る枚数 */
  copies: number
  /** 正典の【表示】文。UI と説明書がそのまま出す */
  text: string
}

export interface CardInstance {
  /** インスタンス固有。同名カードが最大4枚あるため対象指定に必須 */
  uid: number
  defId: CardId
}

export interface ZoneState {
  cards: CardInstance[]
}

export interface LogEntry {
  turn: number
  /** 使用者（そのカードを手札から置いたプレイヤー） */
  player: PlayerId
  cardUid: number
  cardId: CardId
  zone: ZoneKey
  /** 渦潮・刺創の対象 */
  targetUid?: number
  /** 渦潮の移動先 */
  moveTo?: ZoneKey
  /** 安全弁（合法手0件時に手札を捨ててターン終了） */
  discardOnly?: boolean
  /** 対象不在などで設置時効果が不発だった */
  fizzled?: boolean
  /** 繁茂による強制設置だった */
  forced?: boolean
}

export interface GameState {
  zones: Record<ZoneKey, ZoneState>
  hands: [CardInstance[], CardInstance[]]
  /** 先頭がトップ */
  deck: CardInstance[]
  discard: CardInstance[]
  /** 1〜14 */
  turn: number
  current: PlayerId
  /** 繁茂による強制設置先。構造上つねに0個か1個 */
  forcedZone: ZoneKey | null
  rng: RngState
  log: LogEntry[]
  phase: 'playing' | 'finished'
}

export interface Move {
  cardUid: number
  zone: ZoneKey
  /** 渦潮・刺創の対象 */
  targetUid?: number
  /** 渦潮の移動先 */
  moveTo?: ZoneKey
  /** 安全弁（合法手0件時） */
  discardOnly?: boolean
}

const ZONE_OWNER: Record<ZoneKey, PlayerId> = {
  p0z0: 0,
  p0z1: 0,
  p1z0: 1,
  p1z1: 1,
}

const ZONE_SLOT: Record<ZoneKey, ZoneSlot> = {
  p0z0: 'z0',
  p0z1: 'z1',
  p1z0: 'z0',
  p1z1: 'z1',
}

const PLAYER_ZONES: Record<PlayerId, readonly [ZoneKey, ZoneKey]> = {
  0: ['p0z0', 'p0z1'],
  1: ['p1z0', 'p1z1'],
}

export function zoneKey(p: PlayerId, z: ZoneSlot): ZoneKey {
  return PLAYER_ZONES[p][z === 'z0' ? 0 : 1]
}

/** そのゾーンで得点計算を行うプレイヤー（＝持ち主） */
export function ownerOf(key: ZoneKey): PlayerId {
  return ZONE_OWNER[key]
}

export function slotOf(key: ZoneKey): ZoneSlot {
  return ZONE_SLOT[key]
}

export function zonesOf(p: PlayerId): readonly [ZoneKey, ZoneKey] {
  return PLAYER_ZONES[p]
}

export function opponentOf(p: PlayerId): PlayerId {
  return p === 0 ? 1 : 0
}
