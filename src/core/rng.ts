// シード可能な PRNG（mulberry32）。Math.random() は絶対に使わない。
// 状態を GameState に持たせることで、リプレイ・バグ再現・シミュレーションの
// 再現性がすべて確保される。すべて純関数で [値, 次の状態] を返す。

export type RngState = number

/** 任意の数値を 32bit の初期状態に正規化する */
export function seedFrom(seed: number): RngState {
  return Math.trunc(seed) | 0
}

export function nextRandom(s: RngState): [number, RngState] {
  let t = (s + 0x6d2b79f5) | 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, t]
}

/** 0 以上 n 未満の整数。n < 1 のときは 0 を返し、状態は進めない */
export function nextInt(s: RngState, n: number): [number, RngState] {
  if (n < 1) return [0, s]
  const [r, next] = nextRandom(s)
  return [Math.floor(r * n), next]
}

/** Fisher-Yates。入力配列は変更せず、新しい配列を返す */
export function shuffle<T>(items: readonly T[], s: RngState): [T[], RngState] {
  const out = [...items]
  let state = s
  for (let i = out.length - 1; i > 0; i--) {
    const [j, next] = nextInt(state, i + 1)
    state = next
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return [out, state]
}
