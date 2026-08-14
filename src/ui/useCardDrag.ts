// 手札からゾーンへのドラッグ&ドロップ。
//
// HTML5 の drag-and-drop API はタッチ端末で動かないので Pointer Events で実装する。
//
// ★ setPointerCapture は使わない。
//   キャプチャは要素の差し替え・ブラウザ独自ジェスチャ・pointercancel などで暗黙に
//   解放され、解放されるとポインタがカードを離れた時点で pointermove / pointerup が
//   届かなくなる。その結果ゴーストが固まり、選択状態も残り続ける（実測で再現済み）。
//   代わりに押下中だけ window にリスナを張る。window のリスナは、カード要素に何が
//   起きても必ず発火するので、この失敗モード自体が存在しなくなる。
//
// ★ リスナは pointerdown の中で同期的に張る。
//   useEffect 経由にすると React のコミットを待つ間に最初の pointermove を取りこぼし、
//   素早く振ったときにドラッグが始まらない（これも実測で確認した）。
//
// ドロップ先の妥当性判定は selection.ts の selectableZones に委ねており、
// ここでルールを新たに判定することはない。
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { ZoneKey } from '../core/types.ts'
import { ALL_ZONES } from '../core/types.ts'

/** これを超えて動いたらクリックではなくドラッグとみなす */
const DRAG_THRESHOLD = 6

export interface DragState {
  cardUid: number
  /** ポインタ直下のドロップ可能ゾーン */
  over: ZoneKey | null
}

export interface CardDragOptions {
  /** ドラッグを始めたときに呼ぶ（カードを選択状態にする） */
  onDragStart: (cardUid: number) => void
  /** ドロップ可能なゾーンを返す。ドラッグ中に毎回参照する */
  droppableZones: (cardUid: number) => Set<ZoneKey>
  /** 有効なゾーンにドロップしたとき */
  onDrop: (zone: ZoneKey, cardUid: number) => void
  /** ドラッグせずに離したとき（＝クリック） */
  onClick: (cardUid: number) => void
  /** ドラッグを取りやめたとき */
  onCancel: () => void
}

type Outcome = { kind: 'drop'; zone: ZoneKey } | { kind: 'cancel' } | { kind: 'click' }

function isZoneKey(v: string | null): v is ZoneKey {
  return v !== null && (ALL_ZONES as readonly string[]).includes(v)
}

/** ポインタ直下のゾーンを探す。オーバーレイやゴーストは pointer-events: none なので拾われない */
function zoneAt(x: number, y: number): ZoneKey | null {
  const el = document.elementFromPoint(x, y)
  const zone = el?.closest('[data-zone]')?.getAttribute('data-zone') ?? null
  return isZoneKey(zone) ? zone : null
}

export function useCardDrag(options: CardDragOptions) {
  const opts = useRef(options)
  opts.current = options

  const [drag, setDrag] = useState<DragState | null>(null)

  const press = useRef<{ cardUid: number; x: number; y: number } | null>(null)
  const dragging = useRef(false)
  const detach = useRef<(() => void) | null>(null)
  /** ゴーストは state に入れず、この要素の transform を直接書き換える（毎フレームの再描画を避ける） */
  const ghostRef = useRef<HTMLDivElement | null>(null)

  /**
   * 終了はすべてここを通す。リスナの解除、press / dragging / state のクリア、
   * drop・cancel・click のいずれか1つの呼び出しを必ず1箇所で行う。
   */
  const endDrag = useCallback((outcome: Outcome) => {
    detach.current?.()
    detach.current = null

    const started = press.current
    press.current = null
    dragging.current = false
    setDrag(null)
    if (started === null) return

    if (outcome.kind === 'drop') opts.current.onDrop(outcome.zone, started.cardUid)
    else if (outcome.kind === 'click') opts.current.onClick(started.cardUid)
    else opts.current.onCancel()
  }, [])

  const onPointerDown = useCallback(
    (cardUid: number) => (e: ReactPointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      // キャプチャは取らない。テキスト選択やネイティブドラッグだけ止める
      e.preventDefault()
      detach.current?.()
      press.current = { cardUid, x: e.clientX, y: e.clientY }
      dragging.current = false

      const handleMove = (ev: PointerEvent) => {
        const start = press.current
        if (start === null) return

        if (!dragging.current) {
          if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) <= DRAG_THRESHOLD) return
          dragging.current = true
          opts.current.onDragStart(start.cardUid)
        }

        // ゴーストの追従は DOM を直接書く（state にすると毎フレーム全体が再描画される）
        const ghost = ghostRef.current
        if (ghost !== null) {
          ghost.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px) translate(-50%, -50%) rotate(-4deg)`
        }

        const zone = zoneAt(ev.clientX, ev.clientY)
        const over =
          zone !== null && opts.current.droppableZones(start.cardUid).has(zone) ? zone : null
        // ドロップ先が変わったときだけ再描画する
        setDrag((prev) =>
          prev !== null && prev.cardUid === start.cardUid && prev.over === over
            ? prev
            : { cardUid: start.cardUid, over },
        )
      }

      const handleUp = (ev: PointerEvent) => {
        const start = press.current
        if (start === null) return
        if (!dragging.current) {
          endDrag({ kind: 'click' })
          return
        }
        const zone = zoneAt(ev.clientX, ev.clientY)
        if (zone !== null && opts.current.droppableZones(start.cardUid).has(zone)) {
          endDrag({ kind: 'drop', zone })
        } else {
          endDrag({ kind: 'cancel' })
        }
      }

      const handleCancel = () => endDrag(dragging.current ? { kind: 'cancel' } : { kind: 'click' })
      const handleKey = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape') endDrag({ kind: 'cancel' })
      }

      // ★ ここで同期的に張る。useEffect にすると最初の pointermove を取りこぼす
      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
      window.addEventListener('pointercancel', handleCancel)
      window.addEventListener('blur', handleCancel)
      window.addEventListener('keydown', handleKey)
      detach.current = () => {
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)
        window.removeEventListener('pointercancel', handleCancel)
        window.removeEventListener('blur', handleCancel)
        window.removeEventListener('keydown', handleKey)
      }
    },
    [endDrag],
  )

  // アンマウント時の後始末
  useEffect(() => () => detach.current?.(), [])

  return {
    drag,
    /** ドラッグ中のゴースト要素に付ける ref */
    ghostRef,
    /** 手札カードに渡すハンドラ（pointerdown だけ。あとは window で受ける） */
    handlers: (cardUid: number) => ({ onPointerDown: onPointerDown(cardUid) }),
  }
}
