import { CARD_DEFS } from '../core/cards.ts'
import type { RefObject } from 'react'
import { PLAYER_LABELS, zoneName } from '../labels.ts'
import { CARD_IMAGES } from './cardImages.ts'
import type { EffectEvent } from './effects.ts'

export interface EffectLayerProps {
  event: EffectEvent | null
  /** カットインを出す局面か（演出 OFF・reduced motion・再生済みでは false） */
  showCutIn: boolean
  /** 退場ゴーストの置き場。useBoardTransition が直接 DOM を差し込む */
  ghostLayerRef: RefObject<HTMLDivElement | null>
  onSkip: () => void
}

/**
 * 演出のオーバーレイ。
 *
 * ゴースト層はつねに存在させる（カットインの有無で ref が付いたり外れたりすると、
 * 退場アニメーションが出るときだけ差し込み先が無い、という取りこぼしが起きる）。
 */
export function EffectLayer({ event, showCutIn, ghostLayerRef, onSkip }: EffectLayerProps) {
  return (
    <>
      <div className="fx-ghosts" ref={ghostLayerRef} aria-hidden="true" />
      {showCutIn && event !== null && <CutIn event={event} onSkip={onSkip} />}
    </>
  )
}

/**
 * 発動カットイン。カードごとに固有の背景モーション（cutin--<cardId>）を持つ。
 *
 * 全面を覆い、クリック（ポインタを置いた時点）で即スキップする。
 * 覆っている間は盤面に触れないので、演出中の誤操作もこれで防げる。
 */
function CutIn({ event, onSkip }: { event: EffectEvent; onSkip: () => void }) {
  const def = CARD_DEFS[event.cardId]

  const tags: string[] = []
  if (event.forced) tags.push('繁茂により強制')
  if (event.discardOnly) tags.push('置ける場所がないため捨札')
  else if (event.fizzled) tags.push('不発')

  return (
    <div
      className={`cutin cutin--${event.cardId}`}
      onPointerDown={onSkip}
      role="presentation"
      key={event.seq}
    >
      <div className="cutin__motif" aria-hidden="true" />
      <div className="cutin__body">
        <img className="cutin__art" src={CARD_IMAGES[def.id]} alt="" />
        <div className="cutin__info">
          {/* 「誰が」「どこへ」。持ち主と使用者は別なので矢印で向きを示す */}
          <p className="cutin__who">
            {PLAYER_LABELS[event.player]}
            {!event.discardOnly && ` → ${zoneName(event.zone)}`}
          </p>
          <h2 className="cutin__name">
            {def.name}
            <span className="cutin__reading">{def.reading}</span>
          </h2>
          {!event.discardOnly && <p className="cutin__text">{def.text}</p>}
          {tags.length > 0 && (
            <p className="cutin__tags">
              {tags.map((t) => (
                <span className="cutin__tag" key={t}>
                  {t}
                </span>
              ))}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
