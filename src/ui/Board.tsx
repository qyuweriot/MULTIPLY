import type { CardInstance, GameState, ZoneKey } from '../core/types.ts'
import { zonesOf } from '../core/types.ts'
import { Zone } from './Zone.tsx'

export interface BoardProps {
  state: GameState
  placeableZones: Set<ZoneKey>
  movableZones: Set<ZoneKey>
  targetUids: Set<number>
  onSelectZone: (zone: ZoneKey) => void
  onSelectMoveTo: (zone: ZoneKey) => void
  onSelectTarget: (uid: number) => void
  onHover: (card: CardInstance | null) => void
}

/**
 * 盤面は固定配置。手番が変わっても動かさない（全公開情報なので反転の必要がなく、
 * 盤面を目で追いやすい）。上段がプレイヤー2、下段がプレイヤー1。
 */
export function Board({
  state,
  placeableZones,
  movableZones,
  targetUids,
  onSelectZone,
  onSelectMoveTo,
  onSelectTarget,
  onHover,
}: BoardProps) {
  const rows: ZoneKey[][] = [[...zonesOf(1)], [...zonesOf(0)]]

  return (
    <div className="board">
      {rows.flat().map((zoneKey) => (
        <Zone
          key={zoneKey}
          state={state}
          zoneKey={zoneKey}
          placeable={placeableZones.has(zoneKey)}
          movable={movableZones.has(zoneKey)}
          forced={state.forcedZone === zoneKey}
          targetUids={targetUids}
          onSelectZone={() =>
            movableZones.has(zoneKey) ? onSelectMoveTo(zoneKey) : onSelectZone(zoneKey)
          }
          onSelectTarget={onSelectTarget}
          onHover={onHover}
        />
      ))}
    </div>
  )
}
