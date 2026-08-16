import { CARD_DEFS } from '../core/cards.ts'
import type { GameState, LogEntry } from '../core/types.ts'
import { PLAYER_LABELS, zoneName } from '../labels.ts'
// ログ時点の盤面は再現しないので、カード名は uid から全体を走査して引く
import { cardNameOf } from './effects.ts'

function describe(state: GameState, e: LogEntry): string {
  if (e.discardOnly) return `${CARD_DEFS[e.cardId].name} を捨てた（置ける場所がない）`

  const parts = [`${CARD_DEFS[e.cardId].name} → ${zoneName(e.zone)}`]
  if (e.targetUid !== undefined) {
    const target = cardNameOf(state, e.targetUid)
    parts.push(e.moveTo ? `${target} を ${zoneName(e.moveTo)} へ移動` : `${target} を捨て札に`)
  }
  if (e.fizzled) parts.push('不発')
  if (e.forced) parts.push('繁茂により強制')
  return parts.join(' / ')
}

export function Log({ state }: { state: GameState }) {
  return (
    <section className="log">
      <h2 className="panel__title">行動ログ</h2>
      {state.log.length === 0 && <p className="log__empty">まだ手が指されていません</p>}
      <ol className="log__list">
        {[...state.log].reverse().map((e) => (
          <li key={e.turn} className="log__item">
            <span className="log__turn">T{e.turn}</span>
            <span className="log__player">{PLAYER_LABELS[e.player]}</span>
            <span className="log__body">{describe(state, e)}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
