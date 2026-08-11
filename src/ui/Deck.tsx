import type { GameState } from '../core/types.ts'

/**
 * 山札と捨て札の枚数表示。
 *
 * 裏面は今のところ CSS で束を描いている。裏面画像（744×1039 PNG）を
 * src/assets/back.png に置いたら、.deck__stack の中身を <img> に差し替えるだけでよい。
 */
export function Deck({ state }: { state: GameState }) {
  return (
    <section className="deck">
      <h2 className="panel__title">山札 / 捨て札</h2>
      <div className="deck__row">
        <div className="deck__item">
          <div className="deck__stack" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="deck__count">
            山札 <b>{state.deck.length}</b>
          </p>
        </div>
        <div className="deck__item">
          <div className="deck__stack deck__stack--empty" aria-hidden="true">
            <span />
          </div>
          <p className="deck__count">
            捨て札 <b>{state.discard.length}</b>
          </p>
        </div>
      </div>
    </section>
  )
}
