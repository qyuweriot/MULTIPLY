// Web Audio による効果音の再生。soundSpec.ts の Sound を鳴らすだけ。
//
// 音声ファイルは持たない。ノイズだけは短いバッファが要るので1つ作って使い回す
// （毎回生成すると連打で目に見えて重くなる）。
//
// ★ 自動再生規制：AudioContext は最初のユーザー操作まで suspended のまま。
//   ページを開いた瞬間に鳴らそうとしても無音になるので、最初の pointerdown /
//   keydown を一度だけ拾って resume する。
import type { Sound, Voice } from './soundSpec.ts'

/** 全体の音量。個々の gain はこれを通ったあとの相対値になる */
const MASTER_GAIN = 0.5

/** ノイズ用バッファの長さ（秒）。いちばん長い noise の減衰より長くしておく */
const NOISE_SEC = 1

/** 完全な無音まで落とさない。exponentialRamp は 0 を受け付けない */
const SILENCE = 0.0001

type Ctx = AudioContext & { __noise?: AudioBuffer }

let ctx: Ctx | null = null
let master: GainNode | null = null
let enabled = true
let unlocked = false

function audioContextClass(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    AudioContext?: typeof AudioContext
    webkitAudioContext?: typeof AudioContext
  }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

/** 最初に鳴らすときまで AudioContext を作らない */
function ensureCtx(): Ctx | null {
  if (ctx !== null) return ctx
  const Klass = audioContextClass()
  if (Klass === null) return null
  ctx = new Klass() as Ctx
  master = ctx.createGain()
  master.gain.value = enabled ? MASTER_GAIN : 0
  master.connect(ctx.destination)
  return ctx
}

/** 白色ノイズ。1つ作って使い回す */
function noiseBuffer(c: Ctx): AudioBuffer {
  if (c.__noise !== undefined) return c.__noise
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * NOISE_SEC), c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  c.__noise = buf
  return buf
}

/**
 * ユーザー操作を待って AudioContext を起こす。
 *
 * 呼ぶのは1回でよい。リスナーは最初の1発で外れる。
 */
export function unlockAudioOnGesture(): () => void {
  if (typeof window === 'undefined' || unlocked) return () => {}
  const wake = () => {
    unlocked = true
    const c = ensureCtx()
    if (c !== null && c.state === 'suspended') void c.resume()
    remove()
  }
  const remove = () => {
    window.removeEventListener('pointerdown', wake)
    window.removeEventListener('keydown', wake)
  }
  window.addEventListener('pointerdown', wake, { once: true })
  window.addEventListener('keydown', wake, { once: true })
  return remove
}

export function setSoundEnabled(on: boolean): void {
  enabled = on
  if (master !== null && ctx !== null) {
    // 切り替えの瞬間のプチノイズを避けて、ごく短くランプする
    master.gain.cancelScheduledValues(ctx.currentTime)
    master.gain.setTargetAtTime(on ? MASTER_GAIN : 0, ctx.currentTime, 0.01)
  }
}

/** voice を1つ組み立てて鳴らす。終わったら自分で切り離す */
function playVoice(c: Ctx, out: GainNode, v: Voice, at: number): void {
  const start = at + (v.delay ?? 0)
  const peak = start + v.attack
  const end = peak + v.decay

  const gain = c.createGain()
  gain.gain.setValueAtTime(SILENCE, start)
  gain.gain.linearRampToValueAtTime(v.gain, peak)
  gain.gain.exponentialRampToValueAtTime(SILENCE, end)

  let node: AudioScheduledSourceNode
  if (v.wave === 'noise') {
    const src = c.createBufferSource()
    src.buffer = noiseBuffer(c)
    node = src
  } else {
    const osc = c.createOscillator()
    osc.type = v.wave
    osc.frequency.setValueAtTime(v.freq, start)
    if (v.toFreq !== undefined && v.toFreq !== v.freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(v.toFreq, 1), end)
    }
    node = osc
  }

  if (v.filter !== undefined) {
    const filter = c.createBiquadFilter()
    filter.type = v.filter.type
    filter.frequency.setValueAtTime(v.filter.freq, start)
    if (v.filter.toFreq !== undefined && v.filter.toFreq !== v.filter.freq) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(v.filter.toFreq, 1), end)
    }
    if (v.filter.q !== undefined) filter.Q.setValueAtTime(v.filter.q, start)
    node.connect(filter)
    filter.connect(gain)
    node.onended = () => {
      node.disconnect()
      filter.disconnect()
      gain.disconnect()
    }
  } else {
    node.connect(gain)
    node.onended = () => {
      node.disconnect()
      gain.disconnect()
    }
  }

  gain.connect(out)
  node.start(start)
  node.stop(end)
}

/**
 * 鳴らす。音が切られていても、AudioContext が無くても、静かに何もしない。
 *
 * node のテスト環境（window も AudioContext も無い）でそのまま呼べるようにして
 * あるので、呼び出し側に環境の分岐を書かなくてよい。
 */
export function playSound(sound: Sound | null): void {
  if (sound === null || !enabled) return
  const c = ensureCtx()
  if (c === null || master === null) return
  // 操作より先に鳴らそうとした場合の保険。規制下では無音のまま進む
  if (c.state === 'suspended') void c.resume()

  const at = c.currentTime
  for (const v of sound.voices) playVoice(c, master, v, at)
}
