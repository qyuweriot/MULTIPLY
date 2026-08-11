import { base, defOf } from '../core/cards.ts'
import type { CardInstance } from '../core/types.ts'
import { CARD_IMAGES } from './cardImages.ts'

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
  size?: 'board' | 'hand'
  onClick?: () => void
  onHover?: (card: CardInstance | null) => void
}

export function Card({
  card,
  value,
  muted = false,
  selectable = false,
  selected = false,
  targetable = false,
  size = 'board',
  onClick,
  onHover,
}: CardProps) {
  const def = defOf(card)
  const original = base(card)
  const changed = value !== undefined && value !== original

  const classes = [
    'card',
    `card--${size}`,
    selectable ? 'card--selectable' : '',
    selected ? 'card--selected' : '',
    targetable ? 'card--targetable' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const label = changed
    ? `${def.name} 本来${original} → 現在${value}`
    : `${def.name} 数値${value ?? original}`

  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      disabled={onClick === undefined}
      onMouseEnter={() => onHover?.(card)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(card)}
      title={`${def.name}（${def.reading}）\n${def.text}`}
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
