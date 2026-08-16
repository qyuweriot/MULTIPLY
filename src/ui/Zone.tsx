import type { CardId, GameState, ZoneKey } from '../core/types.ts'
import { ownerOf, slotOf } from '../core/types.ts'
import { cardValues, zoneTotal } from '../core/value.ts'
import { HYOZAN_ALLOWED_VALUE, isRestricted } from '../core/zone.ts'
import { PLAYER_LABELS, ZONE_LABELS } from '../labels.ts'
import { Card } from './Card.tsx'
import type { HoverHandler } from './Card.tsx'

export interface ZoneProps {
  state: GameState
  zoneKey: ZoneKey
  /** 設置先として選べるか */
  placeable?: boolean
  /** 渦潮の移動先として選べるか */
  movable?: boolean
  /** 繁茂により設置が強制されているゾーン */
  forced?: boolean
  /** ドラッグ中のポインタが乗っている */
  dragOver?: boolean
  /** 効果の対象に選べるカードの uid */
  targetUids?: Set<number>
  /** このゾーンに重ねる演出。key を兼ねる seq とセットで渡す */
  fx?: { cardId: CardId; seq: number } | null
  onSelectZone?: () => void
  onSelectTarget?: (uid: number) => void
  onHover?: HoverHandler
}

export function Zone({
  state,
  zoneKey,
  placeable = false,
  movable = false,
  forced = false,
  dragOver = false,
  targetUids,
  fx = null,
  onSelectZone,
  onSelectTarget,
  onHover,
}: ZoneProps) {
  const zone = state.zones[zoneKey]
  const values = cardValues(state, zoneKey)
  const total = zoneTotal(state, zoneKey)

  const has = (id: string) => zone.cards.some((c) => c.defId === id)
  const kagero = has('kagero')
  // 洞穴は合計を5に上書きするので、個別値は合計に反映されない
  const horaanaFixed = !kagero && has('horaana')
  const restricted = isRestricted(zone)

  const clickable = placeable || movable
  const classes = [
    'zone',
    clickable ? 'zone--clickable' : '',
    placeable ? 'zone--droppable' : '',
    dragOver ? 'zone--dragover' : '',
    forced ? 'zone--forced' : '',
    restricted ? 'zone--restricted' : '',
  ]
    .filter(Boolean)
    .join(' ')

  // data-zone はドラッグ中の elementFromPoint でドロップ先を特定するために使う
  return (
    <section className={classes} data-zone={zoneKey}>
      {fx !== null && (
        <span className={`zone__fx zone__fx--${fx.cardId}`} key={fx.seq} aria-hidden="true" />
      )}
      <header className="zone__head">
        <span className="zone__name">
          {PLAYER_LABELS[ownerOf(zoneKey)]}・{ZONE_LABELS[slotOf(zoneKey)]}
        </span>
        <span className="zone__total">
          合計 <b>{total}</b>
        </span>
      </header>

      <div className="zone__badges">
        {forced && <span className="badge badge--forced">繁茂：ここに置く</span>}
        {kagero && <span className="badge badge--kagero">陽炎：効果無効</span>}
        {horaanaFixed && <span className="badge badge--horaana">洞穴：合計5固定</span>}
        {restricted && (
          <span className="badge badge--lock">氷山：数値{HYOZAN_ALLOWED_VALUE}のみ</span>
        )}
      </div>

      <div className="zone__cards">
        {zone.cards.length === 0 && <p className="zone__empty">（空）</p>}
        {zone.cards.map((card) => {
          const targetable = targetUids?.has(card.uid) ?? false
          return (
            <Card
              key={card.uid}
              card={card}
              value={values.get(card.uid)}
              muted={horaanaFixed}
              targetable={targetable}
              onClick={targetable ? () => onSelectTarget?.(card.uid) : undefined}
              onHover={onHover}
            />
          )
        })}
      </div>

      {/* ボタンの有無で盤面の高さが変わると、着手のたびに無関係なカードまで
          上下にずれ、FLIP がそれを移動として拾ってしまう。枠はつねに置いて
          高さを固定し、中身だけを出し入れする */}
      <div className="zone__action">
        {clickable && (
          <button type="button" className="zone__place" onClick={onSelectZone}>
            {movable ? 'ここへ移動' : 'ここに置く'}
          </button>
        )}
      </div>
    </section>
  )
}
