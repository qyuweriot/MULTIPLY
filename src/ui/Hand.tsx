import type { CardInstance, GameState, PlayerId } from '../core/types.ts'
import { PLAYER_LABELS } from '../labels.ts'
import { Card } from './Card.tsx'

export interface HandProps {
  state: GameState
  player: PlayerId
  /** 選べる手札の uid（手番でないプレイヤーは空集合） */
  selectableUids: Set<number>
  selectedUid: number | null
  onSelect: (uid: number) => void
  onHover: (card: CardInstance | null) => void
}

/** 手札は両者公開（作業計画書 §0）。伏せ札は存在しない */
export function Hand({ state, player, selectableUids, selectedUid, onSelect, onHover }: HandProps) {
  const active = state.current === player && state.phase === 'playing'

  return (
    <section className={`hand ${active ? 'hand--active' : ''}`}>
      <header className="hand__head">
        <span>{PLAYER_LABELS[player]}の手札</span>
        {active && <span className="hand__turn">手番</span>}
      </header>
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
              onClick={selectable ? () => onSelect(card.uid) : undefined}
              onHover={onHover}
            />
          )
        })}
      </div>
    </section>
  )
}
