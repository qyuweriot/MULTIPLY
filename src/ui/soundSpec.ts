// 効果音の設計図。Web Audio にも DOM にも触らない純関数とデータだけ。
//
// ★ 音声ファイルは1つも置かない。すべて sound.ts が Web Audio で合成する。
//   依存が増えず、ライセンスの心配がなく、配布サイズも増えない（カード画像だけで
//   既に約1.8MB ある）。12種の固有音もデータとして書けるぶん手軽になる。
//
// 12種の音は effects.css のカットインのモチーフと対応させてある。目で見える
// モチーフと耳で聞こえるものがずれると、同じ演出だと感じられなくなる。
import type { CardId } from '../core/types.ts'
import type { EffectEvent } from './effects.ts'

export type Wave = 'sine' | 'triangle' | 'square' | 'sawtooth' | 'noise'

/** フィルタ。noise に色を付けるのに使う。freq → toFreq で掃引する */
export interface VoiceFilter {
  type: 'lowpass' | 'bandpass' | 'highpass'
  freq: number
  toFreq?: number
  q?: number
}

/** 音の素。1つの発振器＋包絡に相当する */
export interface Voice {
  wave: Wave
  /** 開始周波数（Hz）。wave が 'noise' なら無視される */
  freq: number
  /** 掃引の終点。省略すると freq のまま */
  toFreq?: number
  /** 山の高さ。0 < gain ≤ 1 */
  gain: number
  /** 立ち上がり（秒） */
  attack: number
  /** 減衰（秒） */
  decay: number
  /** 開始を遅らせる（秒）。アルペジオや二度打ちを作る */
  delay?: number
  filter?: VoiceFilter
}

export interface Sound {
  voices: Voice[]
}

/**
 * 1つの音の総尺の上限（秒）。
 *
 * これを超えると次の操作に音が被る。データ側で守り、テストで固定する。
 */
export const MAX_SOUND_SEC = 1.5

/** その音が鳴り終わるまでの秒数 */
export function durationOf(sound: Sound): number {
  return Math.max(0, ...sound.voices.map((v) => (v.delay ?? 0) + v.attack + v.decay))
}

/**
 * 同時に鳴る音量の合計の上限。
 *
 * 各 voice が鳴っている区間を [delay, delay+attack+decay] と見て、重なりの
 * ゲイン合計の最大を採る。実際の包絡は山型なので、これは安全側の見積り。
 * 1.0 を超えるとクリップして歪む。
 */
export function peakGain(sound: Sound): number {
  const starts = sound.voices.map((v) => v.delay ?? 0)
  let peak = 0
  // 立ち上がりの瞬間だけ調べれば足りる。合計が増えるのはそこだけ
  for (const t of starts) {
    let sum = 0
    for (const v of sound.voices) {
      const from = v.delay ?? 0
      if (t >= from && t <= from + v.attack + v.decay) sum += v.gain
    }
    if (sum > peak) peak = sum
  }
  return peak
}

/**
 * 音量を落とし減衰を詰めた版。不発・捨札の「湿った」表現に使う。
 *
 * 別の音を用意するのではなく元の音を加工するのは、「同じカードだが不発だった」
 * ことを耳で結びつけられるようにするため。
 */
export function dampen(sound: Sound): Sound {
  return {
    voices: sound.voices.map((v) => ({
      ...v,
      gain: v.gain * 0.4,
      decay: v.decay * 0.45,
      // 掃引も詰めて、伸びやかさを消す
      ...(v.toFreq !== undefined ? { toFreq: v.freq + (v.toFreq - v.freq) * 0.5 } : {}),
    })),
  }
}

// ── カードごとの音（カットインのモチーフに対応）─────────────────────

export const CARD_SOUNDS: Record<CardId, Sound> = {
  // 斬撃。鋭いノイズが高域から落ちる
  shiso: {
    voices: [
      {
        wave: 'noise',
        freq: 0,
        gain: 0.34,
        attack: 0.004,
        decay: 0.16,
        filter: { type: 'bandpass', freq: 4200, toFreq: 900, q: 1.2 },
      },
      { wave: 'triangle', freq: 1200, toFreq: 300, gain: 0.16, attack: 0.003, decay: 0.1 },
    ],
  },

  // 陽炎。わずかにずらした2音のうなりで揺らぎを作る
  kagero: {
    voices: [
      { wave: 'sine', freq: 660, gain: 0.16, attack: 0.09, decay: 0.5 },
      { wave: 'sine', freq: 667, gain: 0.16, attack: 0.09, decay: 0.5 },
      { wave: 'sine', freq: 990, gain: 0.08, attack: 0.12, decay: 0.45, delay: 0.05 },
    ],
  },

  // 断崖。足元が抜けるように落ちる
  dangai: {
    voices: [
      { wave: 'triangle', freq: 400, toFreq: 70, gain: 0.3, attack: 0.006, decay: 0.45 },
      { wave: 'sine', freq: 200, toFreq: 50, gain: 0.2, attack: 0.01, decay: 0.5, delay: 0.02 },
    ],
  },

  // 氷山。硬質な高いベル
  hyozan: {
    voices: [
      { wave: 'sine', freq: 1568, gain: 0.18, attack: 0.002, decay: 0.55 },
      { wave: 'sine', freq: 2349, gain: 0.1, attack: 0.002, decay: 0.38, delay: 0.01 },
      { wave: 'sine', freq: 3136, gain: 0.05, attack: 0.002, decay: 0.28, delay: 0.02 },
    ],
  },

  // 渦潮。バンドパスを上下に回して渦の周回を作る
  uzushio: {
    voices: [
      {
        wave: 'noise',
        freq: 0,
        gain: 0.22,
        attack: 0.06,
        decay: 0.45,
        filter: { type: 'bandpass', freq: 300, toFreq: 1800, q: 6 },
      },
      {
        wave: 'noise',
        freq: 0,
        gain: 0.18,
        attack: 0.05,
        decay: 0.4,
        delay: 0.12,
        filter: { type: 'bandpass', freq: 1800, toFreq: 400, q: 6 },
      },
      { wave: 'sine', freq: 330, toFreq: 440, gain: 0.1, attack: 0.08, decay: 0.35 },
    ],
  },

  // 疾風。吹き抜ける
  shippu: {
    voices: [
      {
        wave: 'noise',
        freq: 0,
        gain: 0.26,
        attack: 0.08,
        decay: 0.3,
        filter: { type: 'highpass', freq: 400, toFreq: 2400 },
      },
      {
        wave: 'noise',
        freq: 0,
        gain: 0.18,
        attack: 0.04,
        decay: 0.34,
        delay: 0.1,
        filter: { type: 'lowpass', freq: 3000, toFreq: 800 },
      },
    ],
  },

  // 双翼。2枚そろって成立する札なので、2度の羽ばたき
  soyoku: {
    voices: [
      { wave: 'triangle', freq: 587.3, gain: 0.18, attack: 0.01, decay: 0.22 },
      { wave: 'triangle', freq: 880, gain: 0.18, attack: 0.01, decay: 0.26, delay: 0.1 },
    ],
  },

  // 平原。開けた場所の空気。引き直しの「仕切り直し」感
  heigen: {
    voices: [
      { wave: 'sine', freq: 392, gain: 0.14, attack: 0.05, decay: 0.5 },
      { wave: 'sine', freq: 587.3, gain: 0.12, attack: 0.06, decay: 0.45, delay: 0.04 },
      { wave: 'sine', freq: 784, gain: 0.1, attack: 0.07, decay: 0.4, delay: 0.08 },
    ],
  },

  // 繁茂。伸びていく上昇アルペジオ
  hanmo: {
    voices: [
      { wave: 'triangle', freq: 261.6, gain: 0.16, attack: 0.008, decay: 0.2 },
      { wave: 'triangle', freq: 329.6, gain: 0.16, attack: 0.008, decay: 0.22, delay: 0.08 },
      { wave: 'triangle', freq: 392, gain: 0.16, attack: 0.008, decay: 0.26, delay: 0.16 },
      { wave: 'triangle', freq: 523.3, gain: 0.14, attack: 0.008, decay: 0.3, delay: 0.24 },
    ],
  },

  // 洞穴。低く長い残響
  horaana: {
    voices: [
      { wave: 'sine', freq: 82.4, gain: 0.3, attack: 0.02, decay: 0.7 },
      { wave: 'sine', freq: 123.5, gain: 0.16, attack: 0.05, decay: 0.65, delay: 0.03 },
      {
        wave: 'noise',
        freq: 0,
        gain: 0.1,
        attack: 0.1,
        decay: 0.6,
        delay: 0.05,
        filter: { type: 'lowpass', freq: 300 },
      },
    ],
  },

  // 月光。柔らかく差し込む
  gekko: {
    voices: [
      { wave: 'sine', freq: 1046.5, gain: 0.12, attack: 0.12, decay: 0.6 },
      { wave: 'sine', freq: 1318.5, gain: 0.08, attack: 0.16, decay: 0.55, delay: 0.06 },
    ],
  },

  // 足枷。倍音の合わない金属のクランク
  ashikase: {
    voices: [
      { wave: 'square', freq: 147, gain: 0.18, attack: 0.002, decay: 0.18 },
      { wave: 'square', freq: 211, gain: 0.12, attack: 0.002, decay: 0.14, delay: 0.01 },
      {
        wave: 'noise',
        freq: 0,
        gain: 0.16,
        attack: 0.002,
        decay: 0.12,
        filter: { type: 'bandpass', freq: 2200, q: 8 },
      },
    ],
  },
}

// ── 操作音 ─────────────────────────────────────────────────────────

export type UiSound = 'pick' | 'cancel' | 'undo' | 'newGame' | 'win' | 'lose'

export const UI_SOUNDS: Record<UiSound, Sound> = {
  // 選択。押した手応えだけ。短くないと連打で濁る
  pick: {
    voices: [{ wave: 'triangle', freq: 880, gain: 0.1, attack: 0.003, decay: 0.06 }],
  },

  cancel: {
    voices: [{ wave: 'triangle', freq: 440, toFreq: 330, gain: 0.1, attack: 0.004, decay: 0.09 }],
  },

  // 巻き戻し。下がっていく
  undo: {
    voices: [{ wave: 'sine', freq: 660, toFreq: 440, gain: 0.12, attack: 0.01, decay: 0.16 }],
  },

  newGame: {
    voices: [
      { wave: 'sine', freq: 523.3, gain: 0.12, attack: 0.01, decay: 0.16 },
      { wave: 'sine', freq: 784, gain: 0.12, attack: 0.01, decay: 0.22, delay: 0.1 },
    ],
  },

  // 決着。長調で上がる
  win: {
    voices: [
      { wave: 'triangle', freq: 523.3, gain: 0.14, attack: 0.008, decay: 0.22 },
      { wave: 'triangle', freq: 659.3, gain: 0.14, attack: 0.008, decay: 0.24, delay: 0.1 },
      { wave: 'triangle', freq: 784, gain: 0.14, attack: 0.008, decay: 0.28, delay: 0.2 },
      { wave: 'triangle', freq: 1046.5, gain: 0.12, attack: 0.008, decay: 0.5, delay: 0.3 },
    ],
  },

  // 決着。短調で下がる
  lose: {
    voices: [
      { wave: 'triangle', freq: 440, gain: 0.14, attack: 0.01, decay: 0.24 },
      { wave: 'triangle', freq: 349.2, gain: 0.14, attack: 0.01, decay: 0.28, delay: 0.12 },
      { wave: 'sine', freq: 261.6, gain: 0.14, attack: 0.02, decay: 0.6, delay: 0.24 },
    ],
  },
}

/**
 * その着手で鳴らす音。
 *
 * 不発・捨札は同じカードの音を湿らせて返す。別の音にすると「何が起きたか」と
 * 「うまくいかなかった」が切り離れてしまう。
 */
export function soundForEvent(event: EffectEvent | null): Sound | null {
  if (event === null) return null
  const base = CARD_SOUNDS[event.cardId]
  return event.fizzled || event.discardOnly ? dampen(base) : base
}
