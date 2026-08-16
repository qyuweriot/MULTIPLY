import { defOf } from '../core/cards.ts'
import type { CardInstance } from '../core/types.ts'
import type { PassiveState } from './passives.ts'
import { CARD_ASPECT, CARD_IMAGES } from './cardImages.ts'

export interface HoveredCard {
  card: CardInstance
  rect: DOMRect
  /** 盤面のカードなら、いまの数値と常在効果の状態。手札では undefined */
  note?: { value: string; state: PassiveState; reason: string }
}

/** カードの横に置く余白 */
const GAP = 14
/** ビューポート端からの最小マージン */
const MARGIN = 12

function layout(rect: DOMRect) {
  const height = Math.min(520, window.innerHeight * 0.7)
  const width = height * CARD_ASPECT

  // 右に出す。はみ出すなら左へ反転する
  let left = rect.right + GAP
  if (left + width > window.innerWidth - MARGIN) left = rect.left - GAP - width
  left = Math.max(MARGIN, Math.min(left, window.innerWidth - width - MARGIN))

  // 縦はカードの中心に合わせ、ビューポート内にクランプする
  let top = rect.top + rect.height / 2 - height / 2
  top = Math.max(MARGIN, Math.min(top, window.innerHeight - height - MARGIN))

  return { left, top, width, height }
}

/**
 * ホバー中のカードを拡大表示するオーバーレイ。
 *
 * pointer-events: none は必須。これがないとドラッグ中の elementFromPoint が
 * オーバーレイを拾ってドロップ先を誤判定し、ホバーも取りこぼす。
 */
export function CardDetail({ hovered }: { hovered: HoveredCard | null }) {
  if (hovered === null) return null

  const def = defOf(hovered.card)
  const { left, top, width, height } = layout(hovered.rect)

  return (
    <div className="detail" style={{ left, top, width }} aria-hidden="true">
      <img src={CARD_IMAGES[def.id]} alt="" style={{ height }} />
      <p className="detail__name">
        {def.name}（{def.reading}）
      </p>
      {hovered.note !== undefined && (
        <p className={`detail__note detail__note--${hovered.note.state}`}>
          {hovered.note.value}
          {hovered.note.reason !== '' && ` ／ ${hovered.note.reason}`}
        </p>
      )}
    </div>
  )
}
