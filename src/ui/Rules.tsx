// 遊び方。全面に重ねるモーダル。
//
// ★ カードの効果文・数値・枚数・ターン数は、ここに書き写さずに定義から引く。
//   書き写すと、カードを調整したときに説明だけ古くなる（Phase 7 で足枷を
//   -2 → -3 にしたばかり）。地の文（進行・4層・落とし穴）だけを新しく書く。
import { useEffect } from 'react'
import { ALL_CARD_DEFS, DECK_SIZE } from '../core/cards.ts'
import type { CardDef } from '../core/types.ts'
import { INITIAL_HAND_SIZE, TOTAL_TURNS } from '../core/setup.ts'
import type { PlayerLabels } from '../labels.ts'
import { ZONE_LABELS } from '../labels.ts'
import { CARD_IMAGES } from './cardImages.ts'

export interface RulesProps {
  labels: PlayerLabels
  onClose: () => void
}

/** 数値の計算順序（正典 §2）。該当カードは定義から引かず、層の説明として書く */
const LAYERS: { order: string; what: string; who: string }[] = [
  { order: '1', what: '数値の変動そのものを止める', who: '陽炎' },
  { order: '2', what: 'ゾーンの合計を上書きする', who: '洞穴' },
  { order: '3', what: 'ゾーン内の数値を一括で書き換える', who: '月光' },
  { order: '4', what: 'カードごとの自己条件で変わる', who: '双翼・断崖・足枷' },
]

/** 正典 §5「直感に反する挙動」。仕様として正しいが事故になりやすいもの */
const PITFALLS: string[] = [
  '陽炎は味方の強化も止める。双翼をそろえたゾーンに置くと 1 → 3 が消えて自滅する',
  '洞穴があるゾーンでは月光が無意味になる。合計を先に上書きしてしまうため',
  '月光は足枷の解除札になる。先に 0 で確定するので、足枷の自己条件が働かない',
  '氷山のあるゾーンに置けるのは本来の数値が 2 のカードだけ（氷山・渦潮・疾風）',
  '相手のゾーンに双翼を置くと、相手の双翼をそろえる手伝いになってしまう',
  '片方のゾーンの合計が 0 なら、掛け算なので得点は 0 になる',
]

/**
 * そのカードがいつ働くか。
 *
 * 層の番号は priority から出す（層1が優先度3、層4が優先度0）。ここを定数表で
 * 持つと、カードの優先度を変えたときに説明だけ古くなる
 */
function kindOf(def: CardDef): string {
  if (def.hasOnPlace) return '置いたとき'
  // 氷山だけは数値を動かさず、置けるカードを制限する
  if (def.id === 'hyozan') return '常にはたらく（設置制限）'
  return `常にはたらく（層 ${4 - def.priority}）`
}

export function Rules({ labels, onClose }: RulesProps) {
  // Esc で閉じる。開いている間だけ張る
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const totalValue = ALL_CARD_DEFS.reduce((sum, d) => sum + d.baseValue * d.copies, 0)

  return (
    // 背景をクリックしても閉じる。中身のクリックは伝播を止める
    <div className="rules" role="dialog" aria-modal="true" aria-label="遊び方" onClick={onClose}>
      <article className="rules__sheet" onClick={(e) => e.stopPropagation()}>
        <header className="rules__head">
          <h2 className="rules__title">遊び方</h2>
          <button type="button" className="rules__close" onClick={onClose}>
            閉じる
          </button>
        </header>

        <section className="rules__block">
          <h3>目的</h3>
          <p>
            自分は <b>{ZONE_LABELS.z0}</b> と <b>{ZONE_LABELS.z1}</b> の2つのゾーンを持つ。
            得点は<b>「{ZONE_LABELS.z0} の合計 × {ZONE_LABELS.z1} の合計」</b>。
            この積が大きいほうが勝ち。
          </p>
          <p>
            <b>並んだ場合は先攻（{labels[0]}）の勝ち。</b>引き分けはない。
            最後に置くのは必ず後攻なので、その一手ぶんの埋め合わせ。
          </p>
        </section>

        <section className="rules__block">
          <h3>進行</h3>
          <ul>
            <li>
              全 <b>{TOTAL_TURNS}</b> ターン。{labels[0]} と {labels[1]} が
              交互に1枚ずつ置く
            </li>
            <li>
              手番の頭に山札から1枚引く。初期手札は <b>{INITIAL_HAND_SIZE}</b> 枚
            </li>
            <li>
              <b>相手のゾーンにも置ける。</b>置いたカードは、そのゾーンの持ち主の得点になる
            </li>
            <li>手札はお互いに見えている。伏せ札はない</li>
            <li>
              山札は <b>{DECK_SIZE}</b> 枚（本来の数値の総和 {totalValue}）
            </li>
          </ul>
        </section>

        <section className="rules__block">
          <h3>数値の決まり方</h3>
          <p>
            効果は次の順に処理する。<b>先に決まった数値は、あとの層では変わらない。</b>
          </p>
          {/* 番号はカード欄の「層 1」と対応するので、マーカー任せにせず自分で出す */}
          <ul className="rules__layers">
            {LAYERS.map((l) => (
              <li key={l.order}>
                <span className="rules__layer-no">層 {l.order}</span>
                <span className="rules__layer-what">{l.what}</span>
                <span className="rules__layer-who">{l.who}</span>
              </li>
            ))}
          </ul>
          <p className="rules__note">
            条件に使う数値は、つねに<b>本来の数値</b>（効果で変わる前の値）を見る。
          </p>
        </section>

        <section className="rules__block">
          <h3>カード（{ALL_CARD_DEFS.length}種 / {DECK_SIZE}枚）</h3>
          <ul className="rules__cards">
            {ALL_CARD_DEFS.map((def) => (
              <li className="rules__card" key={def.id}>
                <img src={CARD_IMAGES[def.id]} alt="" />
                <div className="rules__card-body">
                  <p className="rules__card-name">
                    {def.name}
                    <span className="rules__card-reading">{def.reading}</span>
                  </p>
                  <p className="rules__card-meta">
                    数値 <b>{def.baseValue}</b> ／ {def.copies}枚 ／ {kindOf(def)}
                  </p>
                  <p className="rules__card-text">{def.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rules__block">
          <h3>間違えやすいところ</h3>
          <ul>
            {PITFALLS.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>

        <p className="rules__note">
          盤面では、常にはたらくカードの枠の色で「効いている／打ち消されている／条件を
          満たしていない」が分かる。カードにポインタを乗せると理由が出る。
        </p>
      </article>
    </div>
  )
}
