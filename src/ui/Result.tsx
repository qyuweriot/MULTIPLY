import { result } from '../core/score.ts'
import type { GameState } from '../core/types.ts'
import { PLAYER_LABELS } from '../labels.ts'

/**
 * 決着表示。
 *
 * ★ 選択ガイド（TargetPicker）と同じ .picker の枠を使い、1行に収める。
 *   別の形のパネルにすると、決着した瞬間にその高さぶん盤面全体が下へずれ、
 *   FLIP がそれを移動として拾ってしまう（実測で 128px ずれていた）。
 *
 * ゾーンごとの内訳は盤面（各ゾーンの「合計」と、ゾーン間の得点セル）に出ているので、
 * ここで表を組み直す必要はない。勝敗そのものは得点セルが大きく示す。
 */
export function Result({ state, onRestart }: { state: GameState; onRestart: () => void }) {
  const { scores, winner } = result(state)

  return (
    <div className="picker picker--result">
      <p className="picker__prompt">
        {winner === null ? '引き分け' : `${PLAYER_LABELS[winner]} の勝ち`}
      </p>
      <p className="picker__steps">
        {PLAYER_LABELS[0]} {scores[0]} ／ {PLAYER_LABELS[1]} {scores[1]}
      </p>
      <div className="picker__actions">
        <button type="button" onClick={onRestart}>
          もう一度遊ぶ
        </button>
      </div>
    </div>
  )
}
