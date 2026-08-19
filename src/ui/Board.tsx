import { result } from '../core/score.ts'
import type { GameState, PlayerId, ZoneKey } from '../core/types.ts'
import { zonesOf } from '../core/types.ts'
import { score, zoneTotal } from '../core/value.ts'
import type { PlayerLabels } from '../labels.ts'
import type { HoverHandler, PointerHandlers } from './Card.tsx'
import type { EffectEvent } from './effects.ts'
import { isEffectZone } from './effects.ts'
import { Zone } from './Zone.tsx'

export interface BoardProps {
  state: GameState
  labels: PlayerLabels
  placeableZones: Set<ZoneKey>
  movableZones: Set<ZoneKey>
  targetUids: Set<number>
  dragOverZone: ZoneKey | null
  /** 対象カードをつまんで移動先へ運べるか（渦潮は true、刺創は false） */
  targetDraggable?: boolean
  /** 対象カードに渡すポインタハンドラ */
  targetDragHandlers?: (cardUid: number) => PointerHandlers
  /** 運搬中で持ち上げられているカード */
  draggingUid?: number | null
  /** 再生中の演出。関係するゾーンにだけモーションを重ねる */
  effect?: EffectEvent | null
  onSelectZone: (zone: ZoneKey) => void
  onSelectMoveTo: (zone: ZoneKey) => void
  onSelectTarget: (uid: number) => void
  onHover: HoverHandler
}

// 引き分けはない（同点は先攻の勝ち）。ただし「並んだうえで勝った／負けた」ことは
// 分かるようにする。得点だけ見ると同じ数字なので、理由が伝わらない
const VERDICT_LABELS = {
  win: '勝ち',
  lose: '負け',
  tiedWin: '同点勝ち',
  tiedLose: '同点負け',
} as const

/** 決着していれば、そのプレイヤーから見た勝敗 */
function verdictOf(state: GameState, player: PlayerId): keyof typeof VERDICT_LABELS | null {
  if (state.phase !== 'finished') return null
  // 勝敗の判定は core の result() に任せる。UI 側で組み直さない
  const { winner, tied } = result(state)
  const won = winner === player
  return tied ? (won ? 'tiedWin' : 'tiedLose') : won ? 'win' : 'lose'
}

/**
 * L ゾーンと R ゾーンの間に置く、掛け算の結果。
 * 決着後はここが勝敗の主役になる（上部の決着表示は1行だけに抑えてある）。
 */
function ScoreCell({ state, player }: { state: GameState; player: PlayerId }) {
  const [z0, z1] = zonesOf(player)
  const value = score(state, player)
  // 片方のゾーンが 0 だと積が 0 になる。事故が目で分かるように色を変える
  const zeroed = zoneTotal(state, z0) === 0 || zoneTotal(state, z1) === 0
  const verdict = verdictOf(state, player)

  const classes = [
    'scorecell',
    zeroed ? 'scorecell--zero' : '',
    verdict !== null ? `scorecell--${verdict}` : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes}>
      <span className="scorecell__op">×</span>
      <b className="scorecell__value">{value}</b>
      <span className="scorecell__label">得点</span>
      {verdict !== null && (
        <span className="scorecell__verdict">{VERDICT_LABELS[verdict]}</span>
      )}
    </div>
  )
}

/**
 * 盤面は固定配置。手番が変わっても動かさない（全公開情報なので反転の必要がなく、
 * 盤面を目で追いやすい）。上段が後攻、下段が先攻。
 * 各行は「L ゾーン｜得点｜R ゾーン」の3列。
 */
export function Board({
  state,
  labels,
  placeableZones,
  movableZones,
  targetUids,
  dragOverZone,
  targetDraggable = false,
  targetDragHandlers,
  draggingUid = null,
  effect = null,
  onSelectZone,
  onSelectMoveTo,
  onSelectTarget,
  onHover,
}: BoardProps) {
  // 常在効果の状態が変わったカード。着手のたびにひと押し光らせる
  const lit = new Set(effect?.lit ?? [])

  const renderZone = (zoneKey: ZoneKey) => (
    <Zone
      key={zoneKey}
      state={state}
      zoneKey={zoneKey}
      labels={labels}
      placeable={placeableZones.has(zoneKey)}
      movable={movableZones.has(zoneKey)}
      // 決着後は「次の手番」が無いので、繁茂の強制も見せない
      // （最終手が繁茂だと forcedZone は立ったまま決着する）
      forced={state.phase === 'playing' && state.forcedZone === zoneKey}
      dragOver={dragOverZone === zoneKey}
      targetUids={targetUids}
      targetDraggable={targetDraggable}
      targetDragHandlers={targetDragHandlers}
      draggingUid={draggingUid}
      litUids={lit}
      fx={
        effect !== null && isEffectZone(effect, zoneKey)
          ? { cardId: effect.cardId, seq: effect.seq }
          : null
      }
      onSelectZone={() =>
        movableZones.has(zoneKey) ? onSelectMoveTo(zoneKey) : onSelectZone(zoneKey)
      }
      onSelectTarget={onSelectTarget}
      onHover={onHover}
    />
  )

  return (
    <div className="board">
      {([1, 0] as PlayerId[]).map((player) => {
        const [z0, z1] = zonesOf(player)
        return (
          <div className="board__row" key={player}>
            {renderZone(z0)}
            <ScoreCell state={state} player={player} />
            {renderZone(z1)}
          </div>
        )
      })}
    </div>
  )
}
