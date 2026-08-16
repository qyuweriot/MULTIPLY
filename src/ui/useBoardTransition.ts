// カードの移動・出現・消滅のアニメーション（FLIP）。
//
// ★ 考え方
//   着手のたびに [data-card-uid] 要素の矩形を記録しておき、次の描画で位置が変わった
//   カードに「動く前の位置へ戻す変換」を当ててから、変換なしへアニメーションさせる。
//   同じ uid が手札 → ゾーンへ、ゾーン → 別ゾーンへ（渦潮）、自分の手札 → 相手の手札へ
//   （疾風）移ったときの動きが、これ1つで全部つく。カードごとの場合分けは要らない。
//
// ★ カットインとの噛み合わせ
//   カットインが出ている間に盤面が動くと、肝心の動きが隠れて見えない。
//   Web Animations API の delay と fill: 'backwards' を使い、カットインが引けるまで
//   「動く前の位置」で静止させてから動かす。
//
// ★ 消えたカード（刺創の対象・平原で山札に戻した手札）
//   React が外した DOM ノードは、こちらが参照を持っている限り生き残る。それを
//   ゴースト層へ付け替えて退場アニメーションを流し、終わったら捨てる。
//   clone しないので、見た目は消える直前とまったく同じになる。
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { EffectEvent, MotionMode } from './effects.ts'
import { BOARD_MS, CUTIN_MS, QUICK_MS } from './effects.ts'

/** この距離以下のズレはレイアウトの誤差とみなし、アニメーションしない */
const MOVE_EPSILON = 1

const EASE = 'cubic-bezier(0.2, 0.7, 0.2, 1)'

interface Tracked {
  rect: DOMRect
  el: HTMLElement
  /** いまどの入れ物にいるか。ゾーンは 'p0z0' など、手札は 'hand:0' / 'hand:1' */
  container: string | null
}

function containerOf(el: HTMLElement, hands: HTMLElement[]): string | null {
  const zone = el.closest('[data-zone]')?.getAttribute('data-zone')
  if (zone != null) return zone
  const hand = el.closest('.hand')
  const index = hand === null ? -1 : hands.indexOf(hand as HTMLElement)
  return index === -1 ? null : `hand:${index}`
}

const isHand = (c: string | null): boolean => c !== null && c.startsWith('hand:')

/** サーバー描画（テストの renderToStaticMarkup）では layout effect を使わない */
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

function snapshot(): Map<number, Tracked> {
  const hands = [...document.querySelectorAll<HTMLElement>('.hand')]
  const out = new Map<number, Tracked>()
  for (const el of document.querySelectorAll<HTMLElement>('[data-card-uid]')) {
    const uid = Number(el.dataset.cardUid)
    if (Number.isNaN(uid)) continue
    out.set(uid, { rect: el.getBoundingClientRect(), el, container: containerOf(el, hands) })
  }
  return out
}

/** 消えたカードのノードを、消える直前の位置に固定してゴースト層へ移す */
function toGhost(el: HTMLElement, rect: DOMRect, cardId: string, layer: HTMLElement): void {
  el.classList.add('fx-ghost', `fx-ghost--${cardId}`)
  el.style.position = 'fixed'
  el.style.margin = '0'
  el.style.left = `${rect.left}px`
  el.style.top = `${rect.top}px`
  el.style.width = `${rect.width}px`
  el.style.height = `${rect.height}px`
  layer.append(el)
}

export interface BoardTransition {
  /** 再生中のアニメーションを即座に終わらせる（カットインのスキップ用） */
  skip: () => void
}

/**
 * @param seq 着手のたびに変わる番号。これが変わったときだけアニメーションする
 * @param event 直前の手。動きの見た目をカードごとに変えるのに使う
 * @param ghostLayer 退場ゴーストを置く固定レイヤ
 */
export function useBoardTransition(
  seq: number,
  event: EffectEvent | null,
  ghostLayer: RefObject<HTMLElement | null>,
  mode: MotionMode,
): BoardTransition {
  const prev = useRef<Map<number, Tracked> | null>(null)
  const lastSeq = useRef(seq)
  const running = useRef<Animation[]>([])
  const ghosts = useRef<HTMLElement[]>([])

  /** 再生中のものを畳んで後片付けする。スキップ・連続着手・アンマウントの共通出口 */
  const settle = useCallback(() => {
    for (const a of running.current) a.finish()
    running.current = []
    for (const g of ghosts.current) g.remove()
    ghosts.current = []
  }, [])

  useIsoLayoutEffect(() => {
    // 着手ではない再描画（ホバー・ドラッグなど）では位置を取り直すだけ。
    // 再生中の矩形は変換後の値なので、そのときは触らない
    if (seq === lastSeq.current) {
      if (running.current.length === 0) prev.current = snapshot()
      return
    }
    lastSeq.current = seq

    // 連続着手に備えて、前の再生を確実に畳んでから測る
    settle()

    const before = prev.current
    const after = snapshot()
    prev.current = after

    if (before === null || mode === 'off') return

    const delay = mode === 'full' ? CUTIN_MS : 0
    const duration = mode === 'full' ? BOARD_MS : QUICK_MS
    const timing: KeyframeAnimationOptions = { delay, duration, easing: EASE, fill: 'backwards' }
    // 渦潮に運ばれた「その1枚」だけを回す。渦潮のターンに動いたカードを軒並み回すと、
    // ゾーンの詰め直しでずれただけのカードまで盤面じゅうで回転して、
    // どれが移動したのか分からなくなる
    const swirlUid = event?.cardId === 'uzushio' ? event.moved?.card.uid : undefined
    const anims: Animation[] = []

    for (const [uid, now] of after) {
      const was = before.get(uid)

      // 新しく現れたカード（ドロー・平原で引き直した手札）
      if (was === undefined) {
        anims.push(
          now.el.animate(
            [
              { opacity: 0, transform: 'translateY(10px) scale(0.86)' },
              { opacity: 1, transform: 'none' },
            ],
            timing,
          ),
        )
        continue
      }

      const dx = was.rect.left - now.rect.left
      const dy = was.rect.top - now.rect.top
      if (Math.hypot(dx, dy) <= MOVE_EPSILON) continue

      // 疾風の手札交換は、いっさい動かさずに入れ替える。
      //
      // 上下の手札は画面の端どうしなので、平行移動にすると
      //   ・カットインが明けた瞬間、どちらの手札も空っぽに見える
      //   ・カードが盤面を横切って飛び、何が起きたのか読めない
      // という状態になる（実測で 0/3 枚・0/2 枚まで空になっていた）。
      // フェードで出すのも駄目で、暗転が薄い前後の数百 ms に手札が空の瞬間が残る。
      // 動かさなければ入れ替わりは暗転の裏で完了し、明けた時にはもう新しい手札が
      // 揃っている。「何が起きたか」は手札を横切る風（.hand__fx--shippu）が伝える。
      //
      // 対象は手札どうしの入れ替えだけ。手札 → ゾーンの移動は飛ぶほうが読めるので触らない
      if (isHand(was.container) && isHand(now.container) && was.container !== now.container) {
        continue
      }

      // 渦潮に運ばれたカードだけは、弧を描いて回りながら移る
      const frames: Keyframe[] =
        uid === swirlUid
          ? [
              { transform: `translate(${dx}px, ${dy}px) rotate(0deg)`, offset: 0 },
              {
                transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 26}px) rotate(-200deg) scale(0.78)`,
                offset: 0.55,
              },
              { transform: 'none', offset: 1 },
            ]
          : [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }]

      anims.push(now.el.animate(frames, timing))
    }

    // 消えたカード：外れた実ノードをゴースト層へ移して退場させる
    const layer = ghostLayer.current
    if (layer !== null) {
      for (const [uid, was] of before) {
        if (after.has(uid) || was.el.isConnected) continue
        toGhost(was.el, was.rect, event?.cardId ?? 'plain', layer)
        ghosts.current.push(was.el)
        anims.push(
          was.el.animate(
            [
              { opacity: 1, transform: 'none', filter: 'none' },
              { opacity: 0, transform: 'scale(0.35) rotate(14deg)', filter: 'blur(3px)' },
            ],
            timing,
          ),
        )
      }
    }

    running.current = anims
    void Promise.allSettled(anims.map((a) => a.finished)).then(() => {
      // 次の着手がもう始まっているなら、その再生の後片付けに任せる
      if (running.current !== anims) return
      settle()
    })
  })

  // アンマウント時にゴーストを残さない
  useEffect(() => () => settle(), [settle])

  return { skip: settle }
}
