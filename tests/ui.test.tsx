// UI の描画確認。react-dom/server で静的マークアップに落として検証するので
// jsdom などの追加依存は要らない。
// （ドラッグのポインタ操作だけは DOM が要るため手動確認とする）
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { beginTurn } from '../src/core/apply.ts'
import { CARD_DEFS } from '../src/core/cards.ts'
import { createGame } from '../src/core/setup.ts'
import type { GameState } from '../src/core/types.ts'
import App from '../src/ui/App.tsx'
import { Board } from '../src/ui/Board.tsx'
import { CardDetail } from '../src/ui/CardDetail.tsx'
import type { HoveredCard } from '../src/ui/CardDetail.tsx'
import { EffectLayer } from '../src/ui/EffectLayer.tsx'
import type { EffectEvent } from '../src/ui/effects.ts'
import { Hand } from '../src/ui/Hand.tsx'
import { Result } from '../src/ui/Result.tsx'
import { passiveStatus, valueNote } from '../src/ui/passives.ts'
import { playerLabels } from '../src/labels.ts'
import { makeState, withHand } from './helpers.ts'

const noop = () => {}
/** 既定は人間同士（Player1 / Player2）。CPU 戦を見るテストだけ差し替える */
const LABELS = playerLabels(false)
const CPU_LABELS = playerLabels(true)
const noHandlers = () => ({
  onPointerDown: noop,
  onPointerMove: noop,
  onPointerUp: noop,
  onPointerCancel: noop,
})

function renderBoard(state: GameState, effect: EffectEvent | null = null) {
  return renderToStaticMarkup(
    <Board
      state={state}
      labels={LABELS}
      placeableZones={new Set()}
      movableZones={new Set()}
      targetUids={new Set()}
      dragOverZone={null}
      effect={effect}
      onSelectZone={noop}
      onSelectMoveTo={noop}
      onSelectTarget={noop}
      onHover={noop}
    />,
  )
}

/** 演出イベントの雛形。必要な項目だけ上書きして使う */
function event(over: Partial<EffectEvent> = {}): EffectEvent {
  return {
    seq: 1,
    cardId: 'uzushio',
    cardUid: 0,
    player: 0,
    zone: 'p0z0',
    fizzled: false,
    forced: false,
    discardOnly: false,
    removed: [],
    lit: [],
    ...over,
  }
}

function renderCutIn(e: EffectEvent) {
  return renderToStaticMarkup(
    <EffectLayer event={e} showCutIn labels={LABELS} ghostLayerRef={{ current: null }} onSkip={noop} />,
  )
}

/** CardDetail は配置をビューポートから決めるので、node 環境では窓を与えてやる */
const RECT = { left: 100, top: 100, right: 180, bottom: 210, width: 80, height: 110 } as DOMRect

function renderDetail(hovered: HoveredCard) {
  vi.stubGlobal('window', { innerWidth: 1280, innerHeight: 800 })
  try {
    return renderToStaticMarkup(<CardDetail hovered={hovered} />)
  } finally {
    vi.unstubAllGlobals()
  }
}

function renderHand(
  state: GameState,
  player: 0 | 1,
  selectable: Set<number>,
  labels = LABELS,
) {
  return renderToStaticMarkup(
    <Hand
      state={state}
      player={player}
      labels={labels}
      selectableUids={selectable}
      selectedUid={null}
      draggingUid={null}
      dragHandlers={noHandlers}
      onSelect={noop}
      onHover={noop}
    />,
  )
}

describe('盤面の描画', () => {
  it('4ゾーンの名前と合計が出る', () => {
    const html = renderBoard(makeState({ p0z0: ['dangai'] }))
    expect(html).toContain('Player1-L')
    expect(html).toContain('Player1-R')
    expect(html).toContain('Player2-L')
    expect(html).toContain('Player2-R')
    expect(html).toContain('合計')
    expect(html).toContain('（空）')
  })

  it('カード画像が src 付きで描画される', () => {
    const html = renderBoard(makeState({ p0z0: ['dangai'] }))
    expect(html).toContain('alt="断崖"')
    expect(html).toMatch(/<img[^>]+src="[^"]+\.png"/)
  })

  it('効果で数値が変わったカードに「本来値 → 現在値」が出る', () => {
    // 月光＋断崖：断崖は本来3だが月光により0になる
    const html = renderBoard(makeState({ p0z0: ['gekko', 'dangai'] }))
    expect(html).toContain('card__value--changed')
    expect(html).toContain('<s>3</s>')
    expect(html).toContain('本来3 → 現在0')
  })

  it('変動していないカードには差分表示が出ない', () => {
    const html = renderBoard(makeState({ p0z0: ['dangai'] }))
    expect(html).not.toContain('card__value--changed')
    expect(html).toContain('数値3')
  })

  it('洞穴ゾーンは合計5固定の注記が出て、個別値が淡色になる', () => {
    const html = renderBoard(makeState({ p0z0: ['horaana', 'dangai'] }))
    expect(html).toContain('洞穴：合計5固定')
    expect(html).toContain('card__value--muted')
  })

  it('陽炎が実際に何かを止めていればバッジが出る', () => {
    // 月光がいなければ断崖は3。陽炎はその書き換えを止めている
    expect(renderBoard(makeState({ p0z0: ['kagero', 'gekko'] }))).toContain('陽炎：効果無効')
  })

  it('陽炎が何も止めていなければバッジを出さない（条件未達としてカードの枠だけで示す）', () => {
    const html = renderBoard(makeState({ p0z0: ['kagero'] }))
    expect(html).not.toContain('陽炎：効果無効')
    expect(html).toContain('card--dormant')
  })

  it('氷山ゾーンに設置制限のバッジが出る', () => {
    const html = renderBoard(makeState({ p0z0: ['hyozan'] }))
    expect(html).toContain('氷山：数値2のみ')
    expect(html).toContain('zone--restricted')
    // 氷山のないゾーンには出ない
    expect(html.match(/氷山：数値2のみ/g)).toHaveLength(1)
  })

  it('繁茂の強制先が強調される', () => {
    const base = makeState({})
    const html = renderBoard({ ...base, forcedZone: 'p1z1' })
    expect(html).toContain('zone--forced')
    expect(html).toContain('繁茂：ここに置く')
  })

  it('決着後は繁茂の強制を出さない（最終手が繁茂だと forcedZone が立ったまま残る）', () => {
    const base = makeState({})
    const html = renderBoard({ ...base, forcedZone: 'p1z1', phase: 'finished' })
    expect(html).not.toContain('zone--forced')
    expect(html).not.toContain('繁茂：ここに置く')
  })

  it('ドロップ先を特定するための data-zone が全ゾーンに付く', () => {
    const html = renderBoard(makeState({}))
    for (const z of ['p0z0', 'p0z1', 'p1z0', 'p1z1']) {
      expect(html).toContain(`data-zone="${z}"`)
    }
  })

  it('ドラッグ中のゾーンに droppable / dragover が付く', () => {
    const state = makeState({})
    const html = renderToStaticMarkup(
      <Board
        state={state}
        labels={LABELS}
        placeableZones={new Set(['p0z0', 'p0z1'])}
        movableZones={new Set()}
        targetUids={new Set()}
        dragOverZone="p0z1"
        onSelectZone={noop}
        onSelectMoveTo={noop}
        onSelectTarget={noop}
        onHover={noop}
      />,
    )
    expect(html.match(/zone--droppable/g)).toHaveLength(2)
    expect(html.match(/zone--dragover/g)).toHaveLength(1)
  })
})

describe('常在効果の可視化', () => {
  it('発動中・無効化・条件未達がカードの枠で見分けられる', () => {
    // 陽炎（月光を止めている＝発動中）／月光（陽炎に潰されて無効）／双翼（片翼なので条件未達）
    const html = renderBoard(makeState({ p0z0: ['kagero', 'gekko', 'soyoku'] }))
    expect(html).toContain('card--active')
    expect(html).toContain('card--negated')
    expect(html).toContain('card--dormant')
  })

  it('無効化されているバッジは打ち消し線で出る', () => {
    const html = renderBoard(makeState({ p0z0: ['kagero', 'horaana'] }))
    expect(html).toContain('badge--negated')
    expect(html).toContain('<s>洞穴：合計5固定</s>')
  })

  it('月光にもバッジが出る（以前は月光だけ表示が無かった）', () => {
    expect(renderBoard(makeState({ p0z0: ['gekko'] }))).toContain('月光：1は3・他は0')
  })

  it('設置時効果のカードには状態の枠を付けない', () => {
    const html = renderBoard(makeState({ p0z0: ['shiso', 'uzushio'] }))
    expect(html).not.toContain('card--active')
    expect(html).not.toContain('card--negated')
    expect(html).not.toContain('card--dormant')
  })

  it('状態が変わったカードだけを光らせる', () => {
    const s = makeState({ p0z0: ['dangai', 'heigen', 'soyoku'] })
    const dangai = s.zones.p0z0.cards[0].uid
    const html = renderBoard(s, event({ lit: [dangai] }))
    expect(html.match(/card--lit/g)).toHaveLength(1)
    expect(html).toMatch(new RegExp(`card--lit[^>]*data-card-uid="${dangai}"`))
  })
})

describe('渦潮の対象をつまんで運ぶ', () => {
  const carrying = (targetDraggable: boolean) => {
    const s = makeState({ p0z0: ['heigen'] })
    return renderToStaticMarkup(
      <Board
        state={s}
        labels={LABELS}
        placeableZones={new Set()}
        movableZones={new Set(['p1z0'])}
        targetUids={new Set([s.zones.p0z0.cards[0].uid])}
        targetDraggable={targetDraggable}
        targetDragHandlers={noHandlers}
        dragOverZone={null}
        onSelectZone={noop}
        onSelectMoveTo={noop}
        onSelectTarget={noop}
        onHover={noop}
      />,
    )
  }

  it('運べる局面では、対象カードが操作可能になる（ドラッグハンドラが付く）', () => {
    const html = carrying(true)
    expect(html).toContain('card--targetable')
    // ハンドラの有無は aria-disabled に出る
    expect(html).toContain('aria-disabled="false"')
  })

  it('運べない局面（刺創）でも、クリックでの対象選択は残る', () => {
    const html = carrying(false)
    expect(html).toContain('card--targetable')
    expect(html).toContain('aria-disabled="false"')
  })
})

describe('「ここに置く」の領域確保', () => {
  // ボタンの出入りで盤面の高さが変わると、着手のたびに無関係なカードまで上下にずれ、
  // FLIP がそれを移動として拾ってしまう（実測で 41px ずれていた）。
  // 枠がつねに在ることを固定して、この不具合が黙って戻らないようにする。
  it('ボタンが出ていなくても、置き場の枠は全ゾーンにある', () => {
    const html = renderBoard(makeState({ p0z0: ['dangai'] }))
    expect(html.match(/zone__action/g)).toHaveLength(4)
    expect(html).not.toContain('zone__place')
  })

  it('選べるゾーンでは、枠の中にボタンが入る（枠の外に出ると高さが変わる）', () => {
    const html = renderToStaticMarkup(
      <Board
        state={makeState({})}
        labels={LABELS}
        placeableZones={new Set(['p0z0'])}
        movableZones={new Set(['p1z1'])}
        targetUids={new Set()}
        dragOverZone={null}
        onSelectZone={noop}
        onSelectMoveTo={noop}
        onSelectTarget={noop}
        onHover={noop}
      />,
    )
    expect(html.match(/zone__action/g)).toHaveLength(4)
    expect(html.match(/zone__place/g)).toHaveLength(2)
    expect(html).toContain('<div class="zone__action"><button type="button" class="zone__place"')
    expect(html).toContain('ここに置く')
    expect(html).toContain('ここへ移動')
  })
})

describe('得点セル（L と R の間）', () => {
  it('各プレイヤーの積が盤面の中央に出る', () => {
    const html = renderBoard(
      makeState({
        p0z0: ['kagero'], // 3
        p0z1: ['dangai', 'heigen'], // 4
        p1z0: ['heigen'], // 1
        p1z1: ['heigen', 'hanmo'], // 2
      }),
    )
    expect(html).toContain('scorecell')
    expect(html).toContain('<b class="scorecell__value">12</b>') // p0: 3 × 4
    expect(html).toContain('<b class="scorecell__value">2</b>') // p1: 1 × 2
    expect(html.match(/scorecell__op/g)).toHaveLength(2)
  })

  it('片方のゾーンが0なら警告色になる', () => {
    const html = renderBoard(makeState({ p0z0: ['dangai'] })) // p0z1 が空 → 積0
    expect(html).toContain('scorecell--zero')
    expect(html).toContain('<b class="scorecell__value">0</b>')
  })

  it('両ゾーンに値があれば警告色にならない', () => {
    const html = renderBoard(makeState({ p0z0: ['dangai'], p0z1: ['heigen'] }))
    expect(html).toContain('<b class="scorecell__value">3</b>')
  })
})

describe('ホバー詳細（相手の手札・盤面も対象）', () => {
  it('非操作カードが disabled になっていない（disabled だとホバーが発火しない）', () => {
    const boardHtml = renderBoard(makeState({ p0z0: ['dangai'] }))
    expect(boardHtml).not.toContain('disabled=""')
    expect(boardHtml).toContain('aria-disabled="true"')

    // 相手（手番でない側）の手札も同様
    const s = beginTurn(createGame(1))
    const handHtml = renderHand(s, 1, new Set())
    expect(handHtml).not.toContain('disabled=""')
    expect(handHtml).toContain('aria-disabled="true"')
  })

  it('選択可能なカードは操作可能として描画される', () => {
    const s = beginTurn(createGame(1))
    const html = renderHand(s, 0, new Set(s.hands[0].map((c) => c.uid)))
    expect(html).toContain('aria-disabled="false"')
  })

  it('ホバー前は詳細オーバーレイを描画しない', () => {
    expect(renderToStaticMarkup(<CardDetail hovered={null} />)).toBe('')
  })

  it('盤面のカードは、現在値と常在効果の理由を一行で添える', () => {
    const s = makeState({ p0z0: ['dangai', 'heigen', 'hanmo'] })
    const card = s.zones.p0z0.cards[0]
    const html = renderDetail({
      card,
      rect: RECT,
      note: { value: valueNote(s, 'p0z0', card), ...passiveStatus(s, 'p0z0', card) },
    })
    expect(html).toContain('数値 3 → 0')
    expect(html).toContain('3枚以上あるので数値が0になっている')
    expect(html).toContain('detail__note--active')
  })

  it('手札のカードには理由を添えない', () => {
    const s = withHand(makeState({}), ['dangai'])
    expect(renderDetail({ card: s.hands[0][0], rect: RECT })).not.toContain('detail__note')
  })
})

describe('手札の描画', () => {
  it('手番のプレイヤーに手番バッジが出る', () => {
    const s = beginTurn(createGame(1))
    const html = renderHand(s, 0, new Set(s.hands[0].map((c) => c.uid)))
    expect(html).toContain('hand--active')
    expect(html).toContain('手番')
    expect(html).toContain('card--selectable')
  })

  it('手番でないプレイヤーの手札は選べない', () => {
    const s = beginTurn(createGame(1))
    const html = renderHand(s, 1, new Set())
    expect(html).not.toContain('hand--active')
    expect(html).not.toContain('card--selectable')
  })

  it('手札は両者公開（裏面表示がない）', () => {
    const s = withHand(makeState({}), ['kagero'], 1)
    expect(renderHand(s, 1, new Set())).toContain('alt="陽炎"')
  })

  it('人間戦の見出しは Player1 / Player2', () => {
    const s = beginTurn(createGame(1))
    expect(renderHand(s, 0, new Set())).toContain('Player1 の手札')
    expect(renderHand(s, 1, new Set())).toContain('Player2 の手札')
  })

  // CPU が受け持つのは後攻。ここが逆だと「自分の手札」と「CPU の手札」が入れ替わる
  it('CPU 戦の見出しは Player / CPU', () => {
    const s = beginTurn(createGame(1))
    expect(renderHand(s, 0, new Set(), CPU_LABELS)).toContain('Player の手札')
    expect(renderHand(s, 1, new Set(), CPU_LABELS)).toContain('CPU の手札')
  })
})

describe('アプリ全体', () => {
  it('初期状態が例外なく描画され、盤面・両手札・得点・ログが出る', () => {
    const html = renderToStaticMarkup(<App />)

    expect(html).toContain('MULTIPLY')
    expect(html).toContain('ターン 1 / 14')
    expect(html).toContain('の手番')
    // state はつねにドロー済み（手番側3枚・相手2枚）
    expect(html.match(/class="card card--hand/g)).toHaveLength(5)
    expect(html.match(/（空）/g)).toHaveLength(4)
    expect(html.match(/scorecell__value/g)).toHaveLength(2)
    expect(html).toContain('行動ログ')
    expect(html).toContain('まだ手が指されていません')
    expect(html).toContain('手札からカードを選ぶ')
  })

  it('手番側の手札だけが選択可能になる', () => {
    const html = renderToStaticMarkup(<App />)
    // ドロー後の先攻3枚だけが selectable（後攻の2枚は選べない）
    expect(html.match(/card--selectable/g)).toHaveLength(3)
  })

  it('対戦相手を選べる（人間とCPU3段）', () => {
    const html = renderToStaticMarkup(<App />)
    expect(html).toContain('対戦相手')
    expect(html).toContain('人間（同じ端末で2人）')
    expect(html).toContain('CPU（易）')
    expect(html).toContain('CPU（普通）')
    expect(html).toContain('CPU（強）')
    // 既定はホットシート。思考中表示は出ない
    expect(html).not.toContain('思考中')
  })

  it('演出の ON/OFF を切り替えられる。初期状態ではカットインを出さない', () => {
    const html = renderToStaticMarkup(<App />)
    expect(html).toContain('演出')
    expect(html).toContain('type="checkbox"')
    // 着手前なので再生するものが無い。ゴースト層だけが用意されている
    expect(html).not.toContain('class="cutin')
    expect(html).toContain('fx-ghosts')
  })

  it('サイドパネルと山札・捨て札の表示が無い', () => {
    const html = renderToStaticMarkup(<App />)
    expect(html).not.toContain('app__side')
    expect(html).not.toContain('山札')
    expect(html).not.toContain('捨て札')
  })
})

describe('発動カットイン', () => {
  it('カード名・読み・効果文・置いた場所が出る', () => {
    const html = renderCutIn(event({ cardId: 'uzushio', zone: 'p1z1', player: 0 }))
    expect(html).toContain('渦潮')
    expect(html).toContain('うずしお')
    expect(html).toContain('このゾーンにあるカードを1枚選び、別のゾーンへ移動させる。')
    expect(html).toContain('Player1')
    expect(html).toContain('Player2-R') // 置いた先は相手のゾーン
  })

  it('カードごとに固有のクラスが付く（背景モーションの出し分け）', () => {
    for (const id of ['heigen', 'shippu', 'shiso', 'hanmo', 'kagero', 'gekko'] as const) {
      expect(renderCutIn(event({ cardId: id }))).toContain(`cutin--${id}`)
    }
  })

  it('不発と強制が明示される', () => {
    const html = renderCutIn(event({ cardId: 'shiso', fizzled: true, forced: true }))
    expect(html).toContain('不発')
    expect(html).toContain('繁茂により強制')
  })

  it('通った手には不発の表示が出ない', () => {
    expect(renderCutIn(event())).not.toContain('不発')
  })

  it('置けずに捨てた手は、ゾーン名も効果文も出さない', () => {
    const html = renderCutIn(event({ cardId: 'dangai', discardOnly: true }))
    expect(html).toContain('置ける場所がないため捨札')
    expect(html).not.toContain('Player1-L')
    expect(html).not.toContain(CARD_DEFS.dangai.text)
  })

  it('カットインを出さない局面では描画されない（ゴースト層だけ残る）', () => {
    const html = renderToStaticMarkup(
      <EffectLayer
        event={event()}
        showCutIn={false}
        labels={LABELS}
        ghostLayerRef={{ current: null }}
        onSkip={noop}
      />,
    )
    expect(html).toContain('fx-ghosts')
    expect(html).not.toContain('cutin')
  })
})

describe('盤面に重ねる演出', () => {
  it('渦潮は移動元と移動先の両方が光る', () => {
    const html = renderBoard(
      makeState({ p0z0: ['heigen'] }),
      event({ cardId: 'uzushio', zone: 'p0z0', moved: { card: { uid: 1, defId: 'heigen' }, from: 'p0z0', to: 'p1z1' } }),
    )
    expect(html.match(/zone__fx--uzushio/g)).toHaveLength(2)
  })

  it('通常のカードは置いたゾーンだけが光る', () => {
    const html = renderBoard(makeState({}), event({ cardId: 'hanmo', zone: 'p1z0' }))
    expect(html.match(/zone__fx--hanmo/g)).toHaveLength(1)
  })

  it('演出がなければ何も重ならない', () => {
    expect(renderBoard(makeState({ p0z0: ['dangai'] }))).not.toContain('zone__fx')
  })

  it('カードに data-card-uid が付く（移動アニメーションの対象特定に使う）', () => {
    const s = makeState({ p0z0: ['dangai'] })
    expect(renderBoard(s)).toContain(`data-card-uid="${s.zones.p0z0.cards[0].uid}"`)
    // 手札にも付く（手札 → ゾーンの移動をつなげるため）
    const hand = withHand(makeState({}), ['kagero'])
    expect(renderHand(hand, 0, new Set())).toContain(`data-card-uid="${hand.hands[0][0].uid}"`)
  })
})

describe('結果画面', () => {
  it('得点の式と勝者が出る', () => {
    const base = makeState({
      p0z0: ['kagero'], // 3
      p0z1: ['dangai', 'heigen'], // 4
      p1z0: ['heigen'], // 1
      p1z1: ['heigen'], // 1
    })
    const finished: GameState = { ...base, phase: 'finished' }
    const html = renderToStaticMarkup(<Result state={finished} labels={LABELS} onRestart={noop} />)

    expect(html).toContain('Player1 の勝ち')
    expect(html).toContain('Player1 12')
    expect(html).toContain('Player2 1')
    expect(html).toContain('もう一度遊ぶ')
  })

  it('同点なら先攻の勝ちと出て、同点だったことも分かる', () => {
    const base = makeState({ p0z0: ['heigen'], p0z1: ['heigen'], p1z0: ['heigen'], p1z1: ['heigen'] })
    const html = renderToStaticMarkup(
      <Result state={{ ...base, phase: 'finished' }} labels={LABELS} onRestart={noop} />,
    )
    expect(html).toContain('同点')
    expect(html).toContain('Player1 の勝ち')
    expect(html).not.toContain('引き分け')
  })

  // 決着した瞬間に盤面が下へずれる不具合（実測 128px）を防ぐ。別のパネルにすると戻る。
  it('選択ガイドと同じ .picker の枠を使い、1行に収まっている', () => {
    const base = makeState({ p0z0: ['dangai'], p0z1: ['heigen'] })
    const html = renderToStaticMarkup(
      <Result state={{ ...base, phase: 'finished' }} labels={LABELS} onRestart={noop} />,
    )
    expect(html).toContain('class="picker picker--result"')
    // かつての見出し＋表の3段組みには戻さない
    expect(html).not.toContain('<table')
    expect(html).not.toContain('<h2')
  })

  it('進行中と決着後で、上部の枠が同じ .picker ひとつだけになる', () => {
    const playing = renderToStaticMarkup(<App />)
    // 枠そのものだけを数える（picker__prompt などの子要素は除く）
    const frame = /class="picker(?: picker--\w+)?"/g
    expect(playing.match(frame)).toHaveLength(1)

    const base = makeState({ p0z0: ['dangai'], p0z1: ['heigen'] })
    const done = renderToStaticMarkup(
      <Result state={{ ...base, phase: 'finished' }} labels={LABELS} onRestart={noop} />,
    )
    expect(done.match(frame)).toHaveLength(1)
  })
})

describe('得点セルの勝敗表示', () => {
  const board = makeState({
    p0z0: ['kagero'], // 3
    p0z1: ['dangai', 'heigen'], // 4 → Player1 は 12
    p1z0: ['heigen'], // 1
    p1z1: ['heigen'], // 1 → Player2 は 1
  })

  it('進行中は勝敗を出さない', () => {
    const html = renderBoard(board)
    expect(html).not.toContain('scorecell__verdict')
    expect(html).not.toContain('勝ち')
  })

  it('決着後は勝者に「勝ち」、敗者に「負け」が出る', () => {
    const html = renderBoard({ ...board, phase: 'finished' })
    expect(html.match(/scorecell__verdict/g)).toHaveLength(2)
    expect(html).toContain('scorecell--win')
    expect(html).toContain('scorecell--lose')
    expect(html).toContain('勝ち')
    expect(html).toContain('負け')

    // 「勝ち」が付くのは得点が高いほうのセル。
    // セル単位に切り分けて照合しないと、隣のセルの数字を拾ってしまい
    // 勝敗を取り違えても素通りする
    const cells = html.split('<div class="scorecell').slice(1)
    expect(cells).toHaveLength(2)
    expect(cells.find((c) => c.includes('scorecell--win'))).toContain('scorecell__value">12<')
    expect(cells.find((c) => c.includes('scorecell--lose'))).toContain('scorecell__value">1<')
  })

  it('同点なら先攻側が同点勝ち、後攻側が同点負けになる', () => {
    const even = makeState({
      p0z0: ['heigen'], p0z1: ['heigen'], p1z0: ['heigen'], p1z1: ['heigen'],
    })
    const html = renderBoard({ ...even, phase: 'finished' })
    // セル単位で見ないと、勝敗を取り違えても素通りする。
    // 盤面は後攻（Player2）の行が先に出るので cells[0] が後攻
    const cells = html.split('<div class="scorecell').slice(1)
    expect(cells).toHaveLength(2)
    expect(cells[0]).toContain('scorecell--tiedLose')
    expect(cells[0]).toContain('同点負け')
    expect(cells[1]).toContain('scorecell--tiedWin')
    expect(cells[1]).toContain('同点勝ち')
    expect(html).not.toContain('引き分け')
  })
})
