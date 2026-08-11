import type { CardInstance, GameState, ZoneKey } from '../core/types.ts'
import { ownerOf, slotOf } from '../core/types.ts'
import { cardValues, zoneTotal } from '../core/value.ts'
import { isFull } from '../core/zone.ts'
import { PLAYER_LABELS, ZONE_LABELS } from '../labels.ts'
import { Card } from './Card.tsx'

export interface ZoneProps {
  state: GameState
  zoneKey: ZoneKey
  /** 設置先として選べるか */
  placeable?: boolean
  /** 渦潮の移動先として選べるか */
  movable?: boolean
  /** 繁茂により設置が強制されているゾーン */
  forced?: boolean
  /** 効果の対象に選べるカードの uid */
  targetUids?: Set<number>
  onSelectZone?: () => void
  onSelectTarget?: (uid: number) => void
  onHover?: (card: CardInstance | null) => void
}

export function Zone({
  state,
  zoneKey,
  placeable = false,
  movable = false,
  forced = false,
  targetUids,
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
  const full = isFull(zone)
  const remaining = zone.lockThreshold === null ? null : zone.lockThreshold - zone.cards.length

  const clickable = placeable || movable
  const classes = [
    'zone',
    clickable ? 'zone--clickable' : '',
    forced ? 'zone--forced' : '',
    full ? 'zone--full' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section className={classes}>
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
        {remaining !== null && (
          <span className={`badge ${full ? 'badge--full' : 'badge--lock'}`}>
            {full ? '氷山：満杯' : `氷山：あと${remaining}枚`}
          </span>
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

      {clickable && (
        <button type="button" className="zone__place" onClick={onSelectZone}>
          {movable ? 'ここへ移動' : 'ここに置く'}
        </button>
      )}
    </section>
  )
}
