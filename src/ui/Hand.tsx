import type { CardId, GameState, PlayerId } from '../core/types.ts'
import { PLAYER_LABELS } from '../labels.ts'
import { Card } from './Card.tsx'
import type { HoverHandler, PointerHandlers } from './Card.tsx'

export interface HandProps {
  state: GameState
  player: PlayerId
  /** この手札に重ねる演出（平原・疾風）。key を兼ねる seq とセットで渡す */
  fx?: { cardId: CardId; seq: number } | null
  /** 選べる手札の uid（手番でないプレイヤーは空集合） */
  selectableUids: Set<number>
  selectedUid: number | null
  /** ドラッグ中に持ち上げているカード */
  draggingUid: number | null
  /** 選択可能なカードに付けるポインタハンドラ */
  dragHandlers: (cardUid: number) => PointerHandlers
  /** キーボード操作（Enter / Space）での選択 */
  onSelect: (cardUid: number) => void
  onHover: HoverHandler
}

/** 手札は両者公開（作業計画書 §0）。伏せ札は存在しない */
export function Hand({
  state,
  player,
  fx = null,
  selectableUids,
  selectedUid,
  draggingUid,
  dragHandlers,
  onSelect,
  onHover,
}: HandProps) {
  const active = state.current === player && state.phase === 'playing'

  return (
    <section className={`hand ${active ? 'hand--active' : ''}`}>
      <header className="hand__head">
        <span>{PLAYER_LABELS[player]}の手札</span>
        {active && <span className="hand__turn">手番</span>}
      </header>
      {fx !== null && (
        <span className={`hand__fx hand__fx--${fx.cardId}`} key={fx.seq} aria-hidden="true" />
      )}
      <div className="hand__cards">
        {state.hands[player].length === 0 && <p className="hand__empty">（なし）</p>}
        {state.hands[player].map((card) => {
          const selectable = selectableUids.has(card.uid)
          return (
            <Card
              key={card.uid}
              card={card}
              size="hand"
              selectable={selectable}
              selected={selectedUid === card.uid}
              dragging={draggingUid === card.uid}
              dragHandlers={selectable ? dragHandlers(card.uid) : undefined}
              onClick={selectable ? () => onSelect(card.uid) : undefined}
              onHover={onHover}
            />
          )
        })}
      </div>
    </section>
  )
}
