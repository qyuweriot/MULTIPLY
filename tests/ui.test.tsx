// UI の描画確認。react-dom/server で静的マークアップに落として検証するので
// jsdom などの追加依存は要らない。
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { beginTurn } from '../src/core/apply.ts'
import { createGame } from '../src/core/setup.ts'
import type { GameState } from '../src/core/types.ts'
import App from '../src/ui/App.tsx'
import { Board } from '../src/ui/Board.tsx'
import { Hand } from '../src/ui/Hand.tsx'
import { Result } from '../src/ui/Result.tsx'
import { makeState, withHand } from './helpers.ts'

const noop = () => {}

function renderBoard(state: GameState) {
  return renderToStaticMarkup(
    <Board
      state={state}
      placeableZones={new Set()}
      movableZones={new Set()}
      targetUids={new Set()}
      onSelectZone={noop}
      onSelectMoveTo={noop}
      onSelectTarget={noop}
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
})

describe('手札の描画', () => {
  it('手番のプレイヤーに手番バッジが出る', () => {
    const s = beginTurn(createGame(1))
    const html = renderToStaticMarkup(
      <Hand
        state={s}
        player={0}
        selectableUids={new Set(s.hands[0].map((c) => c.uid))}
        selectedUid={null}
        onSelect={noop}
        onHover={noop}
      />,
    )
    expect(html).toContain('hand--active')
    expect(html).toContain('手番')
    expect(html).toContain('card--selectable')
  })

  it('手番でないプレイヤーの手札は選べない', () => {
    const s = beginTurn(createGame(1))
    const html = renderToStaticMarkup(
      <Hand
        state={s}
        player={1}
        selectableUids={new Set()}
        selectedUid={null}
        onSelect={noop}
        onHover={noop}
      />,
    )
    expect(html).not.toContain('hand--active')
    expect(html).not.toContain('card--selectable')
  })

  it('手札は両者公開（裏面表示がない）', () => {
    const s = withHand(makeState({}), ['kagero'], 1)
    const html = renderToStaticMarkup(
      <Hand
        state={s}
        player={1}
        selectableUids={new Set()}
        selectedUid={null}
        onSelect={noop}
        onHover={noop}
      />,
    )
    expect(html).toContain('alt="陽炎"')
  })
})

describe('アプリ全体', () => {
  it('初期状態が例外なく描画され、盤面・両手札・得点・ログが出る', () => {
    const html = renderToStaticMarkup(<App />)

    expect(html).toContain('MULTIPLY')
    expect(html).toContain('ターン 1 / 14')
    expect(html).toContain('の手番')
    // state はつねにドロー済み（手番側3枚・相手2枚、山札 26 − 1）
    expect(html).toContain('山札 25')
    expect(html.match(/class="card card--hand/g)).toHaveLength(5)
    expect(html.match(/（空）/g)).toHaveLength(4)
    expect(html).toContain('得点')
    expect(html).toContain('行動ログ')
    expect(html).toContain('まだ手が指されていません')
    expect(html).toContain('手札からカードを選ぶ')
  })

  it('手番側の手札だけが選択可能になる', () => {
    const html = renderToStaticMarkup(<App />)
    // ドロー後の先攻3枚だけが selectable（後攻の2枚は選べない）
    expect(html.match(/card--selectable/g)).toHaveLength(3)
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
