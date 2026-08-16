import type { PointerEvent as ReactPointerEvent } from 'react'
import { base, defOf } from '../core/cards.ts'
import type { CardInstance } from '../core/types.ts'
import { CARD_IMAGES } from './cardImages.ts'

/** ホバー通知。矩形は詳細オーバーレイの配置に使う（マウス座標だと追従してちらつく） */
export type HoverHandler = (card: CardInstance | null, rect?: DOMRect) => void

/**
 * useCardDrag が返すハンドラ。pointerdown だけをカードで受け、move / up / cancel は
 * window 側で受ける（ポインタキャプチャに依存しないため）。
 */
export interface PointerHandlers {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void
}

export interface CardProps {
  card: CardInstance
  /** 効果適用後の現在値。手札など「盤面にない」場合は undefined */
  value?: number
  /** 洞穴ゾーンでは個別値が合計に反映されないので淡く出す */
  muted?: boolean
  selectable?: boolean
  selected?: boolean
  /** 効果の対象候補としてのハイライト */
  targetable?: boolean
  /** ドラッグ中で持ち上げられている（元の位置は薄く見せる） */
  dragging?: boolean
  size?: 'board' | 'hand' | 'detail'
  onClick?: () => void
  onHover?: HoverHandler
  /** ドラッグ可能な手札カードにのみ渡す */
  dragHandlers?: PointerHandlers
}

export function Card({
  card,
  value,
  muted = false,
  selectable = false,
  selected = false,
  targetable = false,
  dragging = false,
  size = 'board',
  onClick,
  onHover,
  dragHandlers,
}: CardProps) {
  const def = defOf(card)
  const original = base(card)
  const changed = value !== undefined && value !== original
  const interactive = onClick !== undefined || dragHandlers !== undefined

  const classes = [
    'card',
    `card--${size}`,
    selectable ? 'card--selectable' : '',
    selected ? 'card--selected' : '',
    targetable ? 'card--targetable' : '',
    dragging ? 'card--dragging' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const label = changed
    ? `${def.name} 本来${original} → 現在${value}`
    : `${def.name} 数値${value ?? original}`

  // disabled にすると非操作カードでマウスイベントが飛ばなくなり、相手の手札や
  // 非対象カードでホバー詳細が出せない。aria-disabled で無効を伝えるだけにする。
  // data-card-uid は useBoardTransition が FLIP の対象を特定するために使う。
  // 手札にも盤面にも同じ属性を付けることで、手札 → ゾーン、ゾーン → 別ゾーン（渦潮）、
  // 自分の手札 → 相手の手札（疾風）の移動が、同じ仕組みで1つのアニメーションになる。
  return (
    <button
      type="button"
      className={classes}
      data-card-uid={card.uid}
      aria-disabled={!interactive}
      onClick={(e) => {
        // ドラッグ対応カードはポインタ経路で着手済み。ドロップ直後に発生する
        // マウス由来の click を通すと、消えたカードを選び直して操作不能になる。
        // detail === 0 はキーボード（Enter / Space）由来なので、そこだけ通す。
        if (dragHandlers !== undefined && e.detail !== 0) return
        onClick?.()
      }}
      {...dragHandlers}
      onMouseEnter={(e) => onHover?.(card, e.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => onHover?.(null)}
      onFocus={(e) => onHover?.(card, e.currentTarget.getBoundingClientRect())}
      onBlur={() => onHover?.(null)}
      aria-label={label}
    >
      <img src={CARD_IMAGES[def.id]} alt={def.name} draggable={false} />
      {value !== undefined && (
        <span
          className={[
            'card__value',
            changed ? 'card__value--changed' : '',
            muted ? 'card__value--muted' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {changed ? (
            <>
              <s>{original}</s>
              <b>{value}</b>
            </>
          ) : (
            <b>{value}</b>
          )}
        </span>
      )}
    </button>
  )
}
