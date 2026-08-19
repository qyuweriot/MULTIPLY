import type { CardId, GameState, ZoneKey } from '../core/types.ts'
import { cardValues, zoneTotal } from '../core/value.ts'
import type { PlayerLabels } from '../labels.ts'
import { zoneName } from '../labels.ts'
import { Card } from './Card.tsx'
import type { HoverHandler, PointerHandlers } from './Card.tsx'
import { passiveStatus, zoneBadges } from './passives.ts'

export interface ZoneProps {
  state: GameState
  zoneKey: ZoneKey
  labels: PlayerLabels
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
  /** 対象カードをつまんで移動先へ運べるか（渦潮は true、刺創は false） */
  targetDraggable?: boolean
  /** 対象カードに渡すポインタハンドラ */
  targetDragHandlers?: (cardUid: number) => PointerHandlers
  /** 運搬中で持ち上げられているカード */
  draggingUid?: number | null
  /** この着手で常在効果の状態が変わったカード */
  litUids?: Set<number>
  /** このゾーンに重ねる演出。key を兼ねる seq とセットで渡す */
  fx?: { cardId: CardId; seq: number } | null
  onSelectZone?: () => void
  onSelectTarget?: (uid: number) => void
  onHover?: HoverHandler
}

export function Zone({
  state,
  zoneKey,
  labels,
  placeable = false,
  movable = false,
  forced = false,
  dragOver = false,
  targetUids,
  targetDraggable = false,
  targetDragHandlers,
  draggingUid = null,
  litUids,
  fx = null,
  onSelectZone,
  onSelectTarget,
  onHover,
}: ZoneProps) {
  const zone = state.zones[zoneKey]
  const values = cardValues(state, zoneKey)
  const total = zoneTotal(state, zoneKey)
  const badges = zoneBadges(state, zoneKey, forced)

  const has = (id: CardId) => zone.cards.some((c) => c.defId === id)
  // 洞穴は合計を上書きするので、個別値は合計に反映されない
  const horaanaFixed = !has('kagero') && has('horaana')

  const clickable = placeable || movable
  const classes = [
    'zone',
    clickable ? 'zone--clickable' : '',
    // 設置先も渦潮の移動先も「落とせる場所」として同じ強調にする
    clickable ? 'zone--droppable' : '',
    dragOver ? 'zone--dragover' : '',
    forced ? 'zone--forced' : '',
    has('hyozan') ? 'zone--restricted' : '',
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
        <span className="zone__name">{zoneName(zoneKey, labels)}</span>
        <span className="zone__total">
          合計 <b>{total}</b>
        </span>
      </header>

      {/* どのバッジを出すかは passives.ts が決める。ここで条件を書くと
          「月光だけバッジが無い」「無効化されていても有効と同じ顔で出る」が起きる */}
      <div className="zone__badges">
        {badges.map((b) => (
          <span
            key={b.id}
            className={`badge badge--${b.id} ${b.negated ? 'badge--negated' : ''}`}
          >
            {b.negated ? <s>{b.text}</s> : b.text}
          </span>
        ))}
      </div>

      <div className="zone__cards">
        {zone.cards.length === 0 && <p className="zone__empty">（空）</p>}
        {zone.cards.map((card) => {
          const targetable = targetUids?.has(card.uid) ?? false
          const draggable = targetable && targetDraggable
          return (
            <Card
              key={card.uid}
              card={card}
              value={values.get(card.uid)}
              muted={horaanaFixed}
              targetable={targetable}
              status={passiveStatus(state, zoneKey, card).state}
              lit={litUids?.has(card.uid) ?? false}
              dragging={draggingUid === card.uid}
              dragHandlers={draggable ? targetDragHandlers?.(card.uid) : undefined}
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
