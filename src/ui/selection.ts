// 「カード → ゾーン → 対象 → 移動先」の多段選択。
//
// ルールを UI 側で再実装せず、legalMoves の結果を絞り込むだけにしてある。
// そのため UI からは不正手を構造的に作れない。React に依存しない純関数。
import type { Move, ZoneKey } from '../core/types.ts'

export type Selection =
  | { step: 'card' }
  | { step: 'zone'; cardUid: number }
  | { step: 'target'; cardUid: number; zone: ZoneKey }
  | { step: 'moveTo'; cardUid: number; zone: ZoneKey; targetUid: number }

export type Pick =
  | { cardUid: number }
  | { zone: ZoneKey }
  | { targetUid: number }
  | { moveTo: ZoneKey }

export const START: Selection = { step: 'card' }

/** 選択途中の状態に合致する手だけを残す */
export function matching(moves: Move[], sel: Selection): Move[] {
  return moves.filter((m) => {
    if (sel.step === 'card') return true
    if (m.cardUid !== sel.cardUid) return false
    if (sel.step === 'zone') return true
    if (m.zone !== sel.zone) return false
    if (sel.step === 'target') return true
    return m.targetUid === sel.targetUid
  })
}

export function selectableCards(moves: Move[]): Set<number> {
  return new Set(moves.map((m) => m.cardUid))
}

/** 設置先の候補。カードを選んだ段階でのみ意味を持つ */
export function selectableZones(moves: Move[], sel: Selection): Set<ZoneKey> {
  if (sel.step !== 'zone') return new Set()
  return new Set(matching(moves, sel).map((m) => m.zone))
}

/** 渦潮・刺創の対象候補。対象を取らない手しかなければ空集合になる */
export function selectableTargets(moves: Move[], sel: Selection): Set<number> {
  if (sel.step !== 'target') return new Set()
  return new Set(
    matching(moves, sel)
      .map((m) => m.targetUid)
      .filter((uid): uid is number => uid !== undefined),
  )
}

/**
 * 対象カードをつまんで移動先へ運べるか。
 *
 * 渦潮は運べる（移動先がある）が、刺創は捨て札にするだけで移動先が無いので運べない。
 * 手を見て決めるので、UI 側でカード名を判定する必要はない。
 */
export function targetsDraggable(moves: Move[], sel: Selection): boolean {
  if (sel.step !== 'target') return false
  return matching(moves, sel).some((m) => m.moveTo !== undefined)
}

/** 渦潮の移動先候補 */
export function selectableMoveTos(moves: Move[], sel: Selection): Set<ZoneKey> {
  if (sel.step !== 'moveTo') return new Set()
  return new Set(
    matching(moves, sel)
      .map((m) => m.moveTo)
      .filter((z): z is ZoneKey => z !== undefined),
  )
}

/**
 * 選択を1段進める。確定したら Move を、まだなら次の Selection を返す。
 *
 * ゾーンを選んだ時点で候補が1手に絞れていれば、そこで確定する（刺創で対象が
 * 不在のときなど）。カードを選んだだけでは確定させない — 置き先を見ずに
 * 誤って着手してしまうのを防ぐため。
 */
export function advanceSelection(moves: Move[], sel: Selection, pick: Pick): Selection | Move {
  if ('cardUid' in pick) {
    return { step: 'zone', cardUid: pick.cardUid }
  }

  let next: Selection
  if ('zone' in pick && sel.step === 'zone') {
    next = { step: 'target', cardUid: sel.cardUid, zone: pick.zone }
  } else if ('targetUid' in pick && sel.step === 'target') {
    next = { step: 'moveTo', cardUid: sel.cardUid, zone: sel.zone, targetUid: pick.targetUid }
  } else if ('moveTo' in pick && sel.step === 'moveTo') {
    const move = matching(moves, sel).find((m) => m.moveTo === pick.moveTo)
    if (move === undefined) throw new Error('選択に合致する手がない')
    return move
  } else {
    throw new Error(`この段階では選べない: step=${sel.step}`)
  }

  const candidates = matching(moves, next)
  if (candidates.length === 0) throw new Error('選択に合致する手がない')
  return candidates.length === 1 ? candidates[0] : next
}

/** 選択を1段戻す */
export function backSelection(sel: Selection): Selection {
  switch (sel.step) {
    case 'card':
      return sel
    case 'zone':
      return START
    case 'target':
      return { step: 'zone', cardUid: sel.cardUid }
    case 'moveTo':
      return { step: 'target', cardUid: sel.cardUid, zone: sel.zone }
  }
}

/**
 * UI に出す案内文。
 *
 * 対象選択の段だけは、運べるかどうかで文言を変える。「効果の対象を選ぶ」とだけ
 * 出していたせいで、渦潮を置いたあと何を求められているのか伝わらず、
 * 不具合と誤解される事故が起きた。
 */
export function selectionPrompt(sel: Selection, draggable = false): string {
  switch (sel.step) {
    case 'card':
      return '手札からカードを選ぶ'
    case 'zone':
      return '置くゾーンを選ぶ'
    case 'target':
      return draggable
        ? '移動させるカードを、移動先のゾーンへドラッグ'
        : '効果の対象にするカードを選ぶ'
    case 'moveTo':
      return '移動先のゾーンを選ぶ'
  }
}
