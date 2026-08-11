import { result } from '../core/score.ts'
import type { GameState, PlayerId } from '../core/types.ts'
import { zonesOf } from '../core/types.ts'
import { zoneTotal } from '../core/value.ts'
import { PLAYER_LABELS, ZONE_LABELS } from '../labels.ts'

export function Result({ state, onRestart }: { state: GameState; onRestart: () => void }) {
  const { scores, winner } = result(state)

  return (
    <div className="result">
      <h2 className="result__title">
        {winner === null ? '引き分け' : `${PLAYER_LABELS[winner]} の勝ち`}
      </h2>
      <table className="result__table">
        <thead>
          <tr>
            <th></th>
            <th>{ZONE_LABELS.z0}</th>
            <th></th>
            <th>{ZONE_LABELS.z1}</th>
            <th></th>
            <th>得点</th>
          </tr>
        </thead>
        <tbody>
          {([0, 1] as PlayerId[]).map((p) => {
            const [z0, z1] = zonesOf(p)
            return (
              <tr key={p} className={winner === p ? 'result__row--win' : ''}>
                <th>{PLAYER_LABELS[p]}</th>
                <td>{zoneTotal(state, z0)}</td>
                <td>×</td>
                <td>{zoneTotal(state, z1)}</td>
                <td>=</td>
                <td>
                  <b>{scores[p]}</b>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <button type="button" className="result__restart" onClick={onRestart}>
        もう一度遊ぶ
      </button>
    </div>
  )
}
