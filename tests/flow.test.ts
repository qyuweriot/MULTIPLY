// ゲーム進行の通し検証。docs/作業計画書.md §9 の flow テストのうち、
// 設置時効果に依存しないものを Phase 3 で実装する（繁茂まわりは Phase 4 で追加）。
import { describe, expect, it } from 'vitest'
import { applyMove, beginTurn, playTurn } from '../src/core/apply.ts'
import { legalMoves } from '../src/core/moves.ts'
import { result } from '../src/core/score.ts'
import { createGame, INITIAL_HAND_SIZE, TOTAL_TURNS } from '../src/core/setup.ts'
import type { GameState } from '../src/core/types.ts'
import { allCardUids, makeState, playoutRandom, withHand } from './helpers.ts'

const DECK = 30

describe('14ターンで決着する', () => {
  it('ランダム同士で必ず finished になり、14手の棋譜が残る', () => {
    for (const seed of [0, 1, 42, 2024, -7]) {
      const end = playoutRandom(createGame(seed), seed)
      expect(end.phase, `seed=${seed}`).toBe('finished')
      expect(end.turn, `seed=${seed}`).toBe(TOTAL_TURNS)
      expect(end.log, `seed=${seed}`).toHaveLength(TOTAL_TURNS)
    }
  })

  it('両者が7手ずつ、先攻→後攻の順で打つ', () => {
    const end = playoutRandom(createGame(3), 3)
    expect(end.log.map((e) => e.player)).toEqual([0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1])
    expect(end.log.map((e) => e.turn)).toEqual([...Array(TOTAL_TURNS).keys()].map((i) => i + 1))
  })

  it('決着後に playTurn を呼んでも状態は変わらない', () => {
    const end = playoutRandom(createGame(9), 9)
    expect(playTurn(end, (_, m) => m[0])).toBe(end)
  })

  it('決着後の applyMove は例外になる', () => {
    const end = playoutRandom(createGame(9), 9)
    expect(() => applyMove(end, { cardUid: 0, zone: 'p0z0' })).toThrow(/終了/)
  })
})

describe('合法手は常に存在する', () => {
  it('全ターンで legalMoves が1件以上返る（シード100通り）', () => {
    for (let seed = 0; seed < 100; seed++) {
      let s = createGame(seed)
      let pick = seed
      while (s.phase === 'playing') {
        const drawn = beginTurn(s)
        const moves = legalMoves(drawn)
        expect(moves.length, `seed=${seed} turn=${s.turn}`).toBeGreaterThan(0)
        pick = (pick * 31 + 7) % 1000003
        s = applyMove(drawn, moves[pick % moves.length])
      }
      expect(s.phase).toBe('finished')
    }
  })

  it('安全弁（discardOnly）に頼らずに完走できる', () => {
    for (let seed = 0; seed < 50; seed++) {
      const end = playoutRandom(createGame(seed), seed)
      expect(end.log.some((e) => e.discardOnly), `seed=${seed}`).toBe(false)
    }
  })
})

describe('再現性', () => {
  it('同一シードで2回実行すると同じ棋譜・同じ最終盤面になる', () => {
    for (const seed of [11, 12, 13]) {
      const a = playoutRandom(createGame(seed), seed)
      const b = playoutRandom(createGame(seed), seed)
      expect(a.log).toEqual(b.log)
      expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    }
  })

  it('シードが違えば棋譜も変わる', () => {
    const a = playoutRandom(createGame(1), 1)
    const b = playoutRandom(createGame(2), 2)
    expect(a.log).not.toEqual(b.log)
  })
})

describe('カードの保存', () => {
  it('全ターンを通じて30枚が保存される（消失も重複もない）', () => {
    for (const seed of [4, 5, 6]) {
      let s = createGame(seed)
      let pick = seed
      while (s.phase === 'playing') {
        const uids = allCardUids(s)
        expect(uids, `seed=${seed} turn=${s.turn}`).toHaveLength(DECK)
        expect(new Set(uids).size).toBe(DECK)

        const drawn = beginTurn(s)
        expect(allCardUids(drawn)).toHaveLength(DECK)
        const moves = legalMoves(drawn)
        pick = (pick * 31 + 7) % 1000003
        s = applyMove(drawn, moves[pick % moves.length])
      }
      expect(new Set(allCardUids(s)).size).toBe(DECK)
    }
  })

  it('手札は設置後につねに規定枚数へ戻る', () => {
    const end = playoutRandom(createGame(8), 8)
    expect(end.hands[0]).toHaveLength(INITIAL_HAND_SIZE)
    expect(end.hands[1]).toHaveLength(INITIAL_HAND_SIZE)
  })
})

describe('勝敗判定', () => {
  it('両者の得点と勝者が出る', () => {
    const end = playoutRandom(createGame(42), 42)
    const r = result(end)
    expect(r.scores).toHaveLength(2)
    expect(Number.isFinite(r.scores[0])).toBe(true)
    expect(Number.isFinite(r.scores[1])).toBe(true)
    // 引き分けはない。同点なら先攻の勝ち
    expect(r.winner).toBe(r.scores[0] >= r.scores[1] ? 0 : 1)
    expect(r.tied).toBe(r.scores[0] === r.scores[1])
  })

  it('同点なら先攻の勝ちになり、tied が立つ', () => {
    const s = createGame(0) // 開始直後は 0 対 0
    expect(result(s)).toMatchObject({ scores: [0, 0], winner: 0, tied: true })
  })

  it('後攻が上回っていれば後攻の勝ち（タイブレークは同点のときだけ）', () => {
    const s = makeState({ p0z0: ['heigen'], p0z1: ['heigen'], p1z0: ['dangai'], p1z1: ['dangai'] })
    expect(result(s)).toMatchObject({ scores: [1, 9], winner: 1, tied: false })
  })
})

describe('繁茂の強制（§9）', () => {
  it('繁茂を置いたターンに、自分でセットした制約が消えていない（§7 ステップ3）', () => {
    const s = withHand(makeState({}), ['hanmo'])
    const next = applyMove(s, { cardUid: s.hands[0][0].uid, zone: 'p0z0' })
    expect(next.forcedZone).toBe('p0z0')
  })

  it('強制下のプレイヤーがさらに繁茂を置くと、古い制約が消えて新しい制約が立つ', () => {
    // p1 は p0z0 に縛られている状態で、その p0z0 に繁茂を置く
    const base = withHand(makeState({}), ['hanmo'], 1)
    const s: GameState = { ...base, current: 1, forcedZone: 'p0z0' }
    const next = applyMove(s, { cardUid: s.hands[1][0].uid, zone: 'p0z0' })

    expect(next.log[0].forced).toBe(true) // 古い制約に従って置いた
    expect(next.forcedZone).toBe('p0z0') // 新しい制約が立っている
  })

  it('強制は次の1ターンだけ有効で、そのターンが終われば消える', () => {
    const s = withHand(makeState({}), ['hanmo'])
    const afterHanmo = applyMove(s, { cardUid: s.hands[0][0].uid, zone: 'p1z1' })
    expect(afterHanmo.forcedZone).toBe('p1z1')

    // 縛られた p1 のターン：設置先は p1z1 だけ
    const p1 = withHand(afterHanmo, ['dangai'], 1)
    expect([...new Set(legalMoves(p1).map((m) => m.zone))]).toEqual(['p1z1'])

    // そのターンを終えると制約は消える
    const after = applyMove(p1, { cardUid: p1.hands[1][0].uid, zone: 'p1z1' })
    expect(after.forcedZone).toBeNull()
  })

  it('強制先に置けないカードしか無ければ強制は不発で、自由に置ける', () => {
    const base = withHand(makeState({ p1z1: ['hyozan'] }), ['hanmo'])
    const afterHanmo = applyMove(base, { cardUid: base.hands[0][0].uid, zone: 'p0z0' })
    // p1z1 は氷山ゾーン。断崖（本来3）は置けないので強制は不発になる
    const p1: GameState = { ...withHand(afterHanmo, ['dangai'], 1), forcedZone: 'p1z1' }

    const zones = [...new Set(legalMoves(p1).map((m) => m.zone))].sort()
    expect(zones).toEqual(['p0z0', 'p0z1', 'p1z0'])

    const after = applyMove(p1, { cardUid: p1.hands[1][0].uid, zone: 'p0z1' })
    expect(after.log[0].forced).toBeUndefined()
  })
})

describe('設置制約の寿命', () => {
  it('制約は適用した1ターンで消える（次ターンへ引き継がない）', () => {
    const s = { ...beginTurn(createGame(1)), forcedZone: 'p1z1' as const }
    const next = applyMove(s, { cardUid: s.hands[0][0].uid, zone: 'p1z1' })
    expect(next.forcedZone).toBeNull()
  })

  it('強制で置いた手はログに forced が残る', () => {
    const s = { ...beginTurn(createGame(1)), forcedZone: 'p1z1' as const }
    const next = applyMove(s, { cardUid: s.hands[0][0].uid, zone: 'p1z1' })
    expect(next.log[0].forced).toBe(true)
  })

  it('強制先に置けないカードなら不発なので、どこに置いても forced にはならない', () => {
    // p1z1 は氷山ゾーン。手札の断崖（本来3）はそこに置けないので強制は不発
    const base = withHand(makeState({ p1z1: ['hyozan'] }), ['dangai'])
    const s: GameState = { ...base, forcedZone: 'p1z1' }
    const next = applyMove(s, { cardUid: s.hands[0][0].uid, zone: 'p0z0' })
    expect(next.log[0].forced).toBeUndefined()
  })
})

describe('非破壊性', () => {
  it('beginTurn / applyMove は入力 state を変更しない', () => {
    const s = createGame(77)
    const snapshot = JSON.stringify(s)

    const drawn = beginTurn(s)
    expect(JSON.stringify(s)).toBe(snapshot)

    const drawnSnapshot = JSON.stringify(drawn)
    applyMove(drawn, legalMoves(drawn)[0])
    expect(JSON.stringify(drawn)).toBe(drawnSnapshot)
  })

  it('applyMove は山札に触れない（CPU の先読みが山札を覗かないため）', () => {
    const drawn = beginTurn(createGame(80))
    const next = applyMove(drawn, legalMoves(drawn)[0])
    expect(next.deck).toEqual(drawn.deck)
    expect(next.rng).toBe(drawn.rng)
  })

  it('beginTurn は山札トップを1枚だけ current の手札へ移す', () => {
    const s = createGame(81)
    const drawn = beginTurn(s)
    expect(drawn.deck).toHaveLength(s.deck.length - 1)
    expect(drawn.hands[s.current]).toHaveLength(s.hands[s.current].length + 1)
    expect(drawn.hands[s.current].at(-1)).toEqual(s.deck[0])
    expect(drawn.hands[1 - s.current]).toBe(s.hands[1 - s.current])
  })

  it('applyMove はゾーン配列を共有しない', () => {
    const drawn = beginTurn(createGame(78))
    const next = applyMove(drawn, legalMoves(drawn)[0])
    expect(next.zones).not.toBe(drawn.zones)
    expect(next.log).not.toBe(drawn.log)
  })
})

describe('不正手の検出', () => {
  it('手札にないカードは例外', () => {
    const s = beginTurn(createGame(1))
    expect(() => applyMove(s, { cardUid: 9999, zone: 'p0z0' })).toThrow(/手札に/)
  })

  it('氷山ゾーンへ数値2以外のカードを置こうとすると例外', () => {
    // 実際の氷山を置いたゾーンに、本来の数値が3の断崖を置こうとする
    const s = withHand(makeState({ p0z0: ['hyozan'] }), ['dangai'])
    expect(() => applyMove(s, { cardUid: s.hands[0][0].uid, zone: 'p0z0' })).toThrow(/氷山/)
  })

  it('氷山ゾーンでも数値2のカードなら置ける', () => {
    const s = withHand(makeState({ p0z0: ['hyozan'] }), ['shippu'])
    const next = applyMove(s, { cardUid: s.hands[0][0].uid, zone: 'p0z0' })
    expect(next.zones.p0z0.cards.map((c) => c.defId)).toEqual(['hyozan', 'shippu'])
  })

  it('繁茂の強制を無視した設置は例外', () => {
    const s = { ...beginTurn(createGame(1)), forcedZone: 'p1z1' as const }
    expect(() => applyMove(s, { cardUid: s.hands[0][0].uid, zone: 'p0z0' })).toThrow(/繁茂/)
  })
})
