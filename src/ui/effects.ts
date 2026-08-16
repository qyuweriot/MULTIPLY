// 演出のためのイベント記述。DOM にも React にも依存しない純関数。
//
// ★ コア（src/core）には手を入れない。
//   「何が起きたか」は applyMove が積む LogEntry に、「盤面がどう変わったか」は
//   着手前後の GameState の差分に、すべて残っている。演出のためにコアへ
//   フィールドを足すと、CPU の先読みが持ち回る状態が太って遅くなる。
//
// 注意：差分を取るのは applyMove の直後（beginTurn より前）の状態。
// ドロー後の state と比べると、疾風の手札交換と次ターンのドローが混ざって読めなくなる。
import { CARD_DEFS } from '../core/cards.ts'
import type { CardId, CardInstance, GameState, PlayerId, ZoneKey } from '../core/types.ts'
import { ALL_ZONES } from '../core/types.ts'
import { passiveStatus } from './passives.ts'

// ★ 尺を変えるときは effects.css の --fx-cutin / --fx-board も必ず揃えること。
//   CSS 側のキーフレームはこの2つの変数を尺として使っている。

/** カットインの尺（ms）。この間、盤面のカードは「動く前の位置」で待たされる */
export const CUTIN_MS = 2000

/** カットインが引けたあとに走る盤面アニメーションの尺（ms） */
export const BOARD_MS = 1200

/** 演出を切っているときの盤面アニメーションの尺（ms）。動きの向きだけ分かればよい */
export const QUICK_MS = 160

/** 演出の強さ。'off' は reduced motion 用で、一切アニメーションしない */
export type MotionMode = 'full' | 'quick' | 'off'

export interface EffectEvent {
  /** 単調増加。これが変わったら演出を再生し直す */
  seq: number
  cardId: CardId
  cardUid: number
  /** そのカードを置いたプレイヤー */
  player: PlayerId
  zone: ZoneKey
  /** 設置時効果が不発だった */
  fizzled: boolean
  /** 繁茂により設置先を強制されていた */
  forced: boolean
  /** 安全弁。置ける場所がなく、設置せずに捨てた */
  discardOnly: boolean
  /** 盤面から取り除かれたカード（刺創の対象） */
  removed: CardInstance[]
  /** 渦潮による移動 */
  moved?: { card: CardInstance; from: ZoneKey; to: ZoneKey }
  /**
   * この着手で常在効果の状態が変わったカードの uid。
   *
   * 置かれたカード自身とは限らない。3枚目が置かれて断崖が0になる、
   * 相手が陽炎を置いて月光が止まる、といった**他人の手で条件が動いた瞬間**も入る。
   */
  lit: number[]
}

function boardCards(state: GameState): CardInstance[] {
  return ALL_ZONES.flatMap((z) => state.zones[z].cards)
}

/** uid からカード実体を引く。手札・山札・捨て札・全ゾーンを走査する */
export function findCard(state: GameState, uid: number): CardInstance | undefined {
  const all = [
    ...state.hands[0],
    ...state.hands[1],
    ...state.deck,
    ...state.discard,
    ...boardCards(state),
  ]
  return all.find((c) => c.uid === uid)
}

/** 表示用のカード名。見つからなければ uid をそのまま出す */
export function cardNameOf(state: GameState, uid: number): string {
  const found = findCard(state, uid)
  return found === undefined ? `#${uid}` : CARD_DEFS[found.defId].name
}

/**
 * 直前の1手を演出イベントに翻訳する。
 *
 * @param prev 着手前の盤面
 * @param next applyMove の直後（**beginTurn より前**）の盤面
 */
export function describeEffect(prev: GameState, next: GameState, seq: number): EffectEvent | null {
  const entry = next.log.at(-1)
  if (entry === undefined) return null

  // 盤面から消えたカード。構造上、刺創の対象しかここには入らない
  // （渦潮で移動したカードは移動先のゾーンにいるので消えたことにならない）
  const stillOnBoard = new Set(boardCards(next).map((c) => c.uid))
  const removed = boardCards(prev).filter((c) => !stillOnBoard.has(c.uid))

  let moved: EffectEvent['moved']
  if (entry.moveTo !== undefined && entry.targetUid !== undefined) {
    const card = findCard(prev, entry.targetUid)
    if (card !== undefined) moved = { card, from: entry.zone, to: entry.moveTo }
  }

  return {
    seq,
    cardId: entry.cardId,
    cardUid: entry.cardUid,
    player: entry.player,
    zone: entry.zone,
    fizzled: entry.fizzled === true,
    forced: entry.forced === true,
    discardOnly: entry.discardOnly === true,
    removed,
    lit: changedPassives(prev, next),
    ...(moved !== undefined ? { moved } : {}),
  }
}

/** 常在効果の状態が変わったカードを、全ゾーンから拾う */
function changedPassives(prev: GameState, next: GameState): number[] {
  const out: number[] = []
  for (const zone of ALL_ZONES) {
    for (const card of next.zones[zone].cards) {
      const now = passiveStatus(next, zone, card).state
      if (now === 'none') continue
      // 直前にその盤面のどこに居たかを探す。新しく置かれたカードは prev に居ない
      const wasZone = ALL_ZONES.find((z) => prev.zones[z].cards.some((c) => c.uid === card.uid))
      const before = wasZone === undefined ? 'none' : passiveStatus(prev, wasZone, card).state
      if (before !== now) out.push(card.uid)
    }
  }
  return out
}

/** そのゾーンで演出を光らせるか（渦潮は移動元と移動先の両方） */
export function isEffectZone(event: EffectEvent | null, zone: ZoneKey): boolean {
  if (event === null || event.discardOnly) return false
  return event.zone === zone || event.moved?.to === zone
}
