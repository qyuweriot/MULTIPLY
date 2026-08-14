// CPU 向けの情報制限ビュー（作業計画書 §1-4）。
//
// 山札の「中身」は公開情報である。30枚の構成は既知で、手札・盤面・捨て札はすべて
// 見えるので、残っているカードの集合は誰でも導出できる。秘匿されているのは
// 「順序」だけ。したがってビューでは中身をそのまま渡し、順序だけを潰す。
//
// chooseMove は GameState ではなく PublicView だけを受け取る。型の上で
// カンニングが成立しないようにするためのもの。
import { CARD_ORDER } from '../core/cards.ts'
import type { CardId, CardInstance, GameState, PlayerId } from '../core/types.ts'

export interface PublicView {
  /** 探索に使う盤面。deck は正規化済みで、真の並びを含まない */
  state: GameState
  me: PlayerId
  /** 山札に残っているカードの内訳（順序なし） */
  deckPool: ReadonlyMap<CardId, number>
}

const CARD_RANK = new Map(CARD_ORDER.map((id, i) => [id, i]))

/** 定義順 → uid 順に並べ替える。真の並びに依存しない安定な順序 */
function canonicalize(deck: readonly CardInstance[]): CardInstance[] {
  return [...deck].sort((a, b) => {
    const ra = CARD_RANK.get(a.defId) ?? 0
    const rb = CARD_RANK.get(b.defId) ?? 0
    return ra !== rb ? ra - rb : a.uid - b.uid
  })
}

export function visibleTo(state: GameState, p: PlayerId): PublicView {
  const deckPool = new Map<CardId, number>()
  for (const c of state.deck) deckPool.set(c.defId, (deckPool.get(c.defId) ?? 0) + 1)

  return {
    state: { ...state, deck: canonicalize(state.deck) },
    me: p,
    deckPool,
  }
}
