import type { GameState, PlayerId, ZoneKey } from '../core/types.ts'
import { zonesOf } from '../core/types.ts'
import { score, zoneTotal } from '../core/value.ts'
import type { HoverHandler } from './Card.tsx'
import { Zone } from './Zone.tsx'

export interface BoardProps {
  state: GameState
  placeableZones: Set<ZoneKey>
  movableZones: Set<ZoneKey>
  targetUids: Set<number>
  dragOverZone: ZoneKey | null
  onSelectZone: (zone: ZoneKey) => void
  onSelectMoveTo: (zone: ZoneKey) => void
  onSelectTarget: (uid: number) => void
  onHover: HoverHandler
}

/** 第一ゾーンと第二ゾーンの間に置く、掛け算の結果 */
function ScoreCell({ state, player }: { state: GameState; player: PlayerId }) {
  const [z0, z1] = zonesOf(player)
  const value = score(state, player)
  // 片方のゾーンが 0 だと積が 0 になる。事故が目で分かるように色を変える
  const zeroed = zoneTotal(state, z0) === 0 || zoneTotal(state, z1) === 0

  return (
    <div className={`scorecell ${zeroed ? 'scorecell--zero' : ''}`}>
      <span className="scorecell__op">×</span>
      <b className="scorecell__value">{value}</b>
      <span className="scorecell__label">得点</span>
    </div>
  )
}

/**
 * 盤面は固定配置。手番が変わっても動かさない（全公開情報なので反転の必要がなく、
 * 盤面を目で追いやすい）。上段がプレイヤー2、下段がプレイヤー1。
 * 各行は「第一ゾーン｜得点｜第二ゾーン」の3列。
 */
export function Board({
  state,
  placeableZones,
  movableZones,
  targetUids,
  dragOverZone,
  onSelectZone,
  onSelectMoveTo,
  onSelectTarget,
  onHover,
}: BoardProps) {
  const renderZone = (zoneKey: ZoneKey) => (
    <Zone
      key={zoneKey}
      state={state}
      zoneKey={zoneKey}
      placeable={placeableZones.has(zoneKey)}
      movable={movableZones.has(zoneKey)}
      forced={state.forcedZone === zoneKey}
      dragOver={dragOverZone === zoneKey}
      targetUids={targetUids}
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
