// UI の描画確認。react-dom/server で静的マークアップに落として検証するので
// jsdom などの追加依存は要らない。
// （ドラッグのポインタ操作だけは DOM が要るため手動確認とする）
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { beginTurn } from '../src/core/apply.ts'
import { createGame } from '../src/core/setup.ts'
import type { GameState } from '../src/core/types.ts'
import App from '../src/ui/App.tsx'
import { Board } from '../src/ui/Board.tsx'
import { CardDetail } from '../src/ui/CardDetail.tsx'
import { Hand } from '../src/ui/Hand.tsx'
import { Result } from '../src/ui/Result.tsx'
import { makeState, withHand } from './helpers.ts'

const noop = () => {}
const noHandlers = () => ({
  onPointerDown: noop,
  onPointerMove: noop,
  onPointerUp: noop,
  onPointerCancel: noop,
})

function renderBoard(state: GameState) {
  return renderToStaticMarkup(
    <Board
      state={state}
      placeableZones={new Set()}
      movableZones={new Set()}
      targetUids={new Set()}
      dragOverZone={null}
      onSelectZone={noop}
      onSelectMoveTo={noop}
      onSelectTarget={noop}
      onHover={noop}
    />,
  )
}

function renderHand(state: GameState, player: 0 | 1, selectable: Set<number>) {
  return renderToStaticMarkup(
    <Hand
      state={state}
      player={player}
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
    expect(html).toContain('第一')
    expect(html).toContain('第二')
    expect(html).toContain('プレイヤー1')
    expect(html).toContain('プレイヤー2')
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

  it('陽炎ゾーンに効果無効バッジが出る', () => {
    expect(renderBoard(makeState({ p0z0: ['kagero'] }))).toContain('陽炎：効果無効')
  })

  it('氷山の残り枚数と満杯が出る', () => {
    expect(renderBoard(makeState({ p0z0: ['hyozan'] }))).toContain('氷山：あと1枚')
    expect(renderBoard(makeState({ p0z0: ['hyozan', 'heigen'] }))).toContain('氷山：満杯')
  })

  it('繁茂の強制先が強調される', () => {
    const base = makeState({})
    const html = renderBoard({ ...base, forcedZone: 'p1z1' })
    expect(html).toContain('zone--forced')
    expect(html).toContain('繁茂：ここに置く')
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

describe('得点セル（第一と第二の間）', () => {
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

  it('サイドパネルと山札・捨て札の表示が無い', () => {
    const html = renderToStaticMarkup(<App />)
    expect(html).not.toContain('app__side')
    expect(html).not.toContain('山札')
    expect(html).not.toContain('捨て札')
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
    const html = renderToStaticMarkup(<Result state={finished} onRestart={noop} />)

    expect(html).toContain('プレイヤー1 の勝ち')
    expect(html).toContain('<b>12</b>')
    expect(html).toContain('<b>1</b>')
    expect(html).toContain('もう一度遊ぶ')
  })

  it('同点なら引き分けと出る', () => {
    const base = makeState({ p0z0: ['heigen'], p0z1: ['heigen'], p1z0: ['heigen'], p1z1: ['heigen'] })
    const html = renderToStaticMarkup(
      <Result state={{ ...base, phase: 'finished' }} onRestart={noop} />,
    )
    expect(html).toContain('引き分け')
  })
})
