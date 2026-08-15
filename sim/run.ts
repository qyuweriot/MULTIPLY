// バランス調整用の CLI シミュレータ（作業計画書 §11）。
//
//   npm run sim -- --games 10000 --p0 hard --p1 hard --seed 42
//
// コアが純関数なので UI を介さず回せる。同じ引数なら結果は完全に再現する。
import { chooseMove, DIFFICULTIES } from '../src/ai/search.ts'
import type { Difficulty } from '../src/ai/search.ts'
import { visibleTo } from '../src/ai/view.ts'
import { applyMove, beginTurn } from '../src/core/apply.ts'
import { CARD_DEFS } from '../src/core/cards.ts'
import { seedFrom } from '../src/core/rng.ts'
import { result } from '../src/core/score.ts'
import { createGame } from '../src/core/setup.ts'
import type { GameState, PlayerId } from '../src/core/types.ts'
import { ALL_ZONES } from '../src/core/types.ts'
import { score, zoneTotal } from '../src/core/value.ts'
import type { GameRecord, Metrics } from './metrics.ts'
import { summarize } from './metrics.ts'

interface Options {
  games: number
  p0: Difficulty
  p1: Difficulty
  seed: number
  json: boolean
}

function parseArgs(argv: string[]): Options {
  const o: Options = { games: 1000, p0: 'hard', p1: 'hard', seed: 0, json: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    if (a === '--games') o.games = Number(next())
    else if (a === '--seed') o.seed = Number(next())
    else if (a === '--p0') o.p0 = asDifficulty(next())
    else if (a === '--p1') o.p1 = asDifficulty(next())
    else if (a === '--json') o.json = true
    else if (a === '--help' || a === '-h') {
      console.log('使い方: npm run sim -- --games 10000 --p0 hard --p1 hard --seed 42 [--json]')
      process.exit(0)
    } else throw new Error(`不明な引数: ${a}`)
  }
  if (!Number.isFinite(o.games) || o.games < 1) throw new Error('--games は1以上の整数')
  return o
}

function asDifficulty(v: string | undefined): Difficulty {
  if (v !== undefined && (DIFFICULTIES as readonly string[]).includes(v)) return v as Difficulty
  throw new Error(`難易度は ${DIFFICULTIES.join(' / ')} のいずれか（受け取った値: ${v}）`)
}

/** リードしているプレイヤー。並んでいたら null */
function leaderOf(state: GameState): PlayerId | null {
  const a = score(state, 0)
  const b = score(state, 1)
  return a > b ? 0 : b > a ? 1 : null
}

function playGame(seed: number, aiSeed: number, difficulties: [Difficulty, Difficulty]): GameRecord {
  let s = beginTurn(createGame(seed))
  let rng = seedFrom(aiSeed)
  let leaderBeforeLastMove: PlayerId | null = null

  while (s.phase === 'playing') {
    // 最終ターンの着手直前のリードを記録する
    if (s.turn === 14) leaderBeforeLastMove = leaderOf(s)

    const { move, rng: nextRng } = chooseMove(
      visibleTo(s, s.current),
      difficulties[s.current],
      rng,
    )
    rng = nextRng
    const after = applyMove(s, move)
    s = after.phase === 'playing' ? beginTurn(after) : after
  }

  const { scores, winner } = result(s)
  let emptyZones = 0
  let crushedZones = 0
  const crushedBy = { gekko: 0, ashikase: 0, other: 0 }
  for (const z of ALL_ZONES) {
    const cards = s.zones[z].cards
    if (cards.length === 0) {
      emptyZones++
    } else if (zoneTotal(s, z) <= 0) {
      crushedZones++
      // 何がゾーンを潰したのか。月光と足枷が両方いれば月光を主因とみなす
      if (cards.some((c) => c.defId === 'gekko')) crushedBy.gekko++
      else if (cards.some((c) => c.defId === 'ashikase')) crushedBy.ashikase++
      else crushedBy.other++
    }
  }

  return { scores, winner, leaderBeforeLastMove, log: s.log, emptyZones, crushedZones, crushedBy }
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`
const mark = (ok: boolean) => (ok ? '✓' : '未達')

function report(o: Options, m: Metrics, elapsedMs: number) {
  const rows: [string, string, string, boolean][] = [
    ['先攻勝率', pct(m.firstPlayerWinRate), '50 ± 3%', Math.abs(m.firstPlayerWinRate - 0.5) <= 0.03],
    ['引き分け率', pct(m.drawRate), '5% 未満', m.drawRate < 0.05],
    ['0点決着率', pct(m.zeroScoreRate), '5% 未満', m.zeroScoreRate < 0.05],
    ['平均スコア', m.averageScore.toFixed(1), '25〜35', m.averageScore >= 25 && m.averageScore <= 35],
    ['最終ターン逆転率', pct(m.lastTurnSwingRate), '30% 未満', m.lastTurnSwingRate < 0.3],
  ]

  console.log(`\n=== ${o.p0} 対 ${o.p1} ／ ${m.games}戦 ／ seed=${o.seed} ===`)
  console.log(`    (${(elapsedMs / 1000).toFixed(1)}秒, 1戦あたり ${(elapsedMs / m.games).toFixed(2)}ms)\n`)
  console.log('  指標                 実測       目標        判定')
  console.log('  ' + '─'.repeat(50))
  for (const [name, value, target, ok] of rows) {
    console.log(
      `  ${name.padEnd(18, '　'.length > 1 ? ' ' : ' ')}${value.padStart(8)}   ${target.padEnd(10)} ${mark(ok)}`,
    )
  }

  console.log(`\n  参考: 明確な逆転 ${pct(m.clearReversalRate)} / 最高スコア ${m.maxScore}`)
  console.log(
    `  診断: 空ゾーン ${m.avgEmptyZones.toFixed(2)}個/戦 ・ 潰されたゾーン ${m.avgCrushedZones.toFixed(2)}個/戦`,
  )
  const cb = m.crushedBy
  const cbTotal = cb.gekko + cb.ashikase + cb.other
  console.log(
    `        潰した札: 月光 ${cb.gekko} / 足枷 ${cb.ashikase} / その他 ${cb.other}（計 ${cbTotal}）`,
  )
  console.log(`        不発 ${pct(m.fizzleRate)} ・ 安全弁 ${pct(m.discardOnlyRate)}`)
  console.log(
    `  先攻: 最終手で勝敗が動かなかった試合の先攻勝率 ${pct(m.firstPlayerWinRateStable)}`,
  )
  console.log(`        勝敗が動いた試合で後攻が勝った割合 ${pct(m.lastMoverWinsSwing)}`)

  console.log('\n  カード別（勝率貢献 / 設置先）')
  console.log('  ' + '─'.repeat(58))
  console.log('  カード   本来値  勝率貢献   標本    延べ設置  自ゾーン率')
  const sorted = [...m.cards].sort((a, b) => b.winRate - a.winRate)
  for (const c of sorted) {
    const d = CARD_DEFS[c.id]
    console.log(
      `  ${d.name}     ${String(d.baseValue).padStart(3)}   ${pct(c.winRate).padStart(7)}  ${String(c.samples).padStart(6)}  ${String(c.placements).padStart(8)}  ${pct(c.ownRate).padStart(8)}`,
    )
  }

  const failed = rows.filter(([, , , ok]) => !ok)
  console.log(
    failed.length === 0
      ? '\n  → §11 の目標をすべて満たしている'
      : `\n  → 未達: ${failed.map(([n]) => n).join(' / ')}`,
  )
}

function main() {
  const o = parseArgs(process.argv.slice(2))
  const records: GameRecord[] = []
  const t0 = performance.now()

  for (let i = 0; i < o.games; i++) {
    // 思考用の乱数はゲーム本体の rng とは別系統
    records.push(playGame(o.seed + i, (o.seed + i) * 7919 + 13, [o.p0, o.p1]))
  }

  const elapsed = performance.now() - t0
  const metrics = summarize(records)

  if (o.json) console.log(JSON.stringify({ options: o, metrics }, null, 2))
  else report(o, metrics, elapsed)
}

main()
