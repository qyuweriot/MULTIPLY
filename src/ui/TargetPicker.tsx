import { defOf } from '../core/cards.ts'
import type { GameState, Move } from '../core/types.ts'
import { zoneName } from '../labels.ts'
import type { Selection } from './selection.ts'
import { selectionPrompt, targetsDraggable } from './selection.ts'

export interface TargetPickerProps {
  state: GameState
  selection: Selection
  /** 対象を運べる局面か（渦潮）。案内文の出し分けに使う */
  moves: Move[]
  onBack: () => void
  onReset: () => void
}

/** 多段選択（カード → ゾーン → 対象 → 移動先）の進行状況と取り消し */
export function TargetPicker({ state, selection, moves, onBack, onReset }: TargetPickerProps) {
  const draggable = targetsDraggable(moves, selection)
  if (selection.step === 'card') {
    return (
      <div className="picker">
        <p className="picker__prompt">{selectionPrompt(selection)}</p>
      </div>
    )
  }

  const hand = state.hands[state.current]
  const card = hand.find((c) => c.uid === selection.cardUid)
  const steps: string[] = []
  if (card) steps.push(defOf(card).name)
  if (selection.step !== 'zone') steps.push(zoneName(selection.zone))
  if (selection.step === 'moveTo') {
    const target = state.zones[selection.zone].cards.find((c) => c.uid === selection.targetUid)
    if (target) steps.push(`対象：${defOf(target).name}`)
  }

  return (
    <div className="picker picker--active">
      <p className="picker__prompt">{selectionPrompt(selection, draggable)}</p>
      <p className="picker__steps">{steps.join(' → ')}</p>
      <div className="picker__actions">
        <button type="button" onClick={onBack}>
          ひとつ戻る
        </button>
        <button type="button" onClick={onReset}>
          選択をやめる
        </button>
      </div>
    </div>
  )
}
