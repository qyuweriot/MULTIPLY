// UI の多段選択ロジック。ルールを再実装していないこと（＝不正手を作れないこと）を固める。
import { describe, expect, it } from 'vitest'
import { applyMove, beginTurn } from '../src/core/apply.ts'
import { legalMoves } from '../src/core/moves.ts'
import { createGame, TOTAL_TURNS } from '../src/core/setup.ts'
import type { GameState, Move, ZoneKey } from '../src/core/types.ts'
import {
  advanceSelection,
  backSelection,
  selectableCards,
  selectableMoveTos,
  selectableTargets,
  selectableZones,
  START,
} from '../src/ui/selection.ts'
import type { Selection } from '../src/ui/selection.ts'
import { makeState, withHand } from './helpers.ts'

const isMove = (v: Selection | Move): v is Move => !('step' in v)

/** カードを選び、ゾーンを選ぶところまで進める */
function pickCardAndZone(state: GameState, zone: ZoneKey) {
  const moves = legalMoves(state)
  const sel = advanceSelection(moves, START, { cardUid: state.hands[state.current][0].uid })
  if (isMove(sel)) throw new Error('カード選択だけで確定してはいけない')
  return { moves, next: advanceSelection(moves, sel, { zone }) }
}

describe('通常カード', () => {
  it('カードを選んだだけでは確定しない（置き先を見せてから着手させる）', () => {
    const s = withHand(makeState({}), ['dangai'])
    const moves = legalMoves(s)
    const sel = advanceSelection(moves, START, { cardUid: s.hands[0][0].uid })
    expect(isMove(sel)).toBe(false)
    expect(sel).toEqual({ step: 'zone', cardUid: s.hands[0][0].uid })
  })

  it('ゾーンを選んだ時点で確定する', () => {
    const s = withHand(makeState({}), ['dangai'])
    const { next } = pickCardAndZone(s, 'p1z0')
    expect(isMove(next)).toBe(true)
    expect(next).toEqual({ cardUid: s.hands[0][0].uid, zone: 'p1z0' })
  })

  it('選べるカードは手札のうち合法手を持つものだけ', () => {
    const s = withHand(makeState({}), ['dangai', 'heigen'])
    expect(selectableCards(legalMoves(s))).toEqual(new Set(s.hands[0].map((c) => c.uid)))
  })
})

describe('刺創', () => {
  it('対象がいるゾーンを選ぶと対象選択へ進む', () => {
    const s = withHand(makeState({ p0z0: ['dangai', 'heigen'] }), ['shiso'])
    const { moves, next } = pickCardAndZone(s, 'p0z0')
    expect(isMove(next)).toBe(false)
    if (isMove(next)) return

    expect(next.step).toBe('target')
    expect(selectableTargets(moves, next)).toEqual(
      new Set(s.zones.p0z0.cards.map((c) => c.uid)),
    )
  })

  it('対象がいなければゾーンを選んだ時点で確定する（不発）', () => {
    const s = withHand(makeState({}), ['shiso'])
    const { next } = pickCardAndZone(s, 'p0z0')
    expect(isMove(next)).toBe(true)
    expect((next as Move).targetUid).toBeUndefined()
  })

  it('対象を選ぶと確定する', () => {
    const s = withHand(makeState({ p0z0: ['dangai', 'heigen'] }), ['shiso'])
    const { moves, next } = pickCardAndZone(s, 'p0z0')
    if (isMove(next)) throw new Error('対象選択に進むはず')

    const targetUid = s.zones.p0z0.cards[1].uid
    const done = advanceSelection(moves, next, { targetUid })
    expect(isMove(done)).toBe(true)
    expect(done).toEqual({ cardUid: s.hands[0][0].uid, zone: 'p0z0', targetUid })
  })
})

describe('渦潮', () => {
  it('対象 → 移動先の2段を経て確定する', () => {
    const s = withHand(makeState({ p0z0: ['dangai'] }), ['uzushio'])
    const { moves, next } = pickCardAndZone(s, 'p0z0')
    if (isMove(next)) throw new Error('対象選択に進むはず')

    const targetUid = s.zones.p0z0.cards[0].uid
    const afterTarget = advanceSelection(moves, next, { targetUid })
    if (isMove(afterTarget)) throw new Error('移動先選択に進むはず')
    expect(afterTarget.step).toBe('moveTo')

    const dests = selectableMoveTos(moves, afterTarget)
    expect(dests).toEqual(new Set(['p0z1', 'p1z0', 'p1z1']))

    const done = advanceSelection(moves, afterTarget, { moveTo: 'p1z1' })
    expect(done).toEqual({ cardUid: s.hands[0][0].uid, zone: 'p0z0', targetUid, moveTo: 'p1z1' })
  })

  it('移動先候補に元ゾーンと満杯ゾーンは出ない', () => {
    const s = withHand(makeState({ p0z0: ['dangai'], p0z1: ['hyozan', 'heigen'] }), ['uzushio'])
    const { moves, next } = pickCardAndZone(s, 'p0z0')
    if (isMove(next)) throw new Error('対象選択に進むはず')

    const afterTarget = advanceSelection(moves, next, { targetUid: s.zones.p0z0.cards[0].uid })
    if (isMove(afterTarget)) throw new Error('移動先選択に進むはず')

    const dests = selectableMoveTos(moves, afterTarget)
    expect(dests.has('p0z0')).toBe(false) // 元ゾーン
    expect(dests.has('p0z1')).toBe(false) // 満杯
    expect(dests).toEqual(new Set(['p1z0', 'p1z1']))
  })

  it('移動先が1つしかなければ対象を選んだ時点で確定する', () => {
    // 対象は2枚あるが、移動先は p1z1 しか空いていない
    const s = withHand(
      makeState({
        p0z0: ['dangai', 'heigen'],
        p0z1: ['hyozan', 'heigen'],
        p1z0: ['hyozan', 'heigen'],
      }),
      ['uzushio'],
    )
    const { moves, next } = pickCardAndZone(s, 'p0z0')
    if (isMove(next)) throw new Error('対象選択に進むはず')

    const done = advanceSelection(moves, next, { targetUid: s.zones.p0z0.cards[0].uid })
    expect(isMove(done)).toBe(true)
    expect((done as Move).moveTo).toBe('p1z1')
  })

  it('対象も移動先も1通りしかなければゾーンを選んだ時点で確定する', () => {
    const s = withHand(
      makeState({
        p0z0: ['dangai'],
        p0z1: ['hyozan', 'heigen'],
        p1z0: ['hyozan', 'heigen'],
      }),
      ['uzushio'],
    )
    const { next } = pickCardAndZone(s, 'p0z0')
    expect(isMove(next)).toBe(true)
    expect(next).toMatchObject({ zone: 'p0z0', moveTo: 'p1z1' })
  })
})

describe('繁茂の強制', () => {
  it('強制先1ゾーンだけが選べる', () => {
    const base = withHand(makeState({}), ['dangai'])
    const s: GameState = { ...base, forcedZone: 'p1z1' }
    const moves = legalMoves(s)
    const sel = advanceSelection(moves, START, { cardUid: s.hands[0][0].uid })
    if (isMove(sel)) throw new Error('ゾーン選択に進むはず')
    expect(selectableZones(moves, sel)).toEqual(new Set(['p1z1']))
  })
})

describe('選択の取り消し', () => {
  it('1段ずつ戻れる', () => {
    const sel: Selection = { step: 'moveTo', cardUid: 1, zone: 'p0z0', targetUid: 2 }
    expect(backSelection(sel)).toEqual({ step: 'target', cardUid: 1, zone: 'p0z0' })
    expect(backSelection(backSelection(sel))).toEqual({ step: 'zone', cardUid: 1 })
    expect(backSelection(backSelection(backSelection(sel)))).toEqual(START)
    expect(backSelection(START)).toEqual(START)
  })
})

describe('UI の選択フローだけでゲームが完走する', () => {
  /** 各段で最初の候補を選び続けて1手を作る */
  function chooseViaUi(moves: Move[], pickIndex: number): Move {
    let sel: Selection = START
    let guard = 0
    for (;;) {
      if (guard++ > 8) throw new Error('選択が収束しない')

      let result: Selection | Move
      if (sel.step === 'card') {
        const cards = [...selectableCards(moves)]
        result = advanceSelection(moves, sel, { cardUid: cards[pickIndex % cards.length] })
      } else if (sel.step === 'zone') {
        const zones = [...selectableZones(moves, sel)]
        result = advanceSelection(moves, sel, { zone: zones[pickIndex % zones.length] })
      } else if (sel.step === 'target') {
        const targets = [...selectableTargets(moves, sel)]
        result = advanceSelection(moves, sel, { targetUid: targets[pickIndex % targets.length] })
      } else {
        const dests = [...selectableMoveTos(moves, sel)]
        result = advanceSelection(moves, sel, { moveTo: dests[pickIndex % dests.length] })
      }

      if (isMove(result)) return result
      sel = result
    }
  }

  it('50シードで14ターン完走し、作られた手はすべて合法手に含まれる', () => {
    for (let seed = 0; seed < 50; seed++) {
      let state = beginTurn(createGame(seed))
      let pick = seed

      while (state.phase === 'playing') {
        const moves = legalMoves(state)
        pick = (pick * 31 + 7) % 1000003
        const move = chooseViaUi(moves, pick)

        // UI が組み立てた手は必ず legalMoves の中にある
        expect(moves, `seed=${seed} turn=${state.turn}`).toContainEqual(move)

        const after = applyMove(state, move)
        state = after.phase === 'playing' ? beginTurn(after) : after
      }

      expect(state.phase, `seed=${seed}`).toBe('finished')
      expect(state.log, `seed=${seed}`).toHaveLength(TOTAL_TURNS)
    }
  })
})
