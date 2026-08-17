// 効果音の設計図（src/ui/soundSpec.ts）。
//
// エンジンは node で鳴らせないので、純関数側を厚く固定する。ここで守っている
// のは「鳴りっぱなしにならない」「クリップしない」「12種が別物である」の3点で、
// どれも耳で気づく前にテストで落ちてほしいもの。
import { describe, expect, it } from 'vitest'
import { CARD_ORDER } from '../src/core/cards.ts'
import type { CardId, ZoneKey } from '../src/core/types.ts'
import type { EffectEvent } from '../src/ui/effects.ts'
import type { Sound } from '../src/ui/soundSpec.ts'
import {
  CARD_SOUNDS,
  MAX_SOUND_SEC,
  UI_SOUNDS,
  dampen,
  durationOf,
  peakGain,
  soundForEvent,
} from '../src/ui/soundSpec.ts'

const ALL_SOUNDS: [string, Sound][] = [
  ...CARD_ORDER.map((id): [string, Sound] => [id, CARD_SOUNDS[id]]),
  ...Object.entries(UI_SOUNDS),
]

function event(over: Partial<EffectEvent> = {}): EffectEvent {
  return {
    seq: 1,
    cardId: 'shiso',
    cardUid: 0,
    player: 0,
    zone: 'p0z0' as ZoneKey,
    fizzled: false,
    forced: false,
    discardOnly: false,
    removed: [],
    lit: [],
    ...over,
  }
}

describe('音がそろっている', () => {
  it('12種すべてに音がある', () => {
    for (const id of CARD_ORDER) {
      expect(CARD_SOUNDS[id]?.voices.length, id).toBeGreaterThan(0)
    }
    expect(Object.keys(CARD_SOUNDS)).toHaveLength(12)
  })

  // 「カットインは12種あるのに音は使い回し」を防ぐ。コピペ事故はこれで落ちる
  it('12種の音が互いに異なる', () => {
    const seen = new Map<string, CardId>()
    for (const id of CARD_ORDER) {
      const key = JSON.stringify(CARD_SOUNDS[id])
      const dup = seen.get(key)
      expect(dup, `${id} の音が ${dup} と同じ`).toBeUndefined()
      seen.set(key, id)
    }
  })

  it('操作音6種が互いに異なる', () => {
    const keys = Object.values(UI_SOUNDS).map((s) => JSON.stringify(s))
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('どの音も健全である', () => {
  it.each(ALL_SOUNDS)('%s の voice が健全', (_name, sound) => {
    for (const v of sound.voices) {
      if (v.wave !== 'noise') {
        expect(Number.isFinite(v.freq) && v.freq > 0).toBe(true)
        if (v.toFreq !== undefined) expect(Number.isFinite(v.toFreq) && v.toFreq > 0).toBe(true)
      }
      expect(v.gain).toBeGreaterThan(0)
      expect(v.gain).toBeLessThanOrEqual(1)
      expect(v.attack).toBeGreaterThan(0)
      expect(v.decay).toBeGreaterThan(0)
      expect(v.delay ?? 0).toBeGreaterThanOrEqual(0)
      if (v.filter !== undefined) {
        expect(v.filter.freq).toBeGreaterThan(0)
        if (v.filter.toFreq !== undefined) expect(v.filter.toFreq).toBeGreaterThan(0)
      }
    }
  })

  // 鳴りっぱなしの音があると、次の操作に被って何が起きたか分からなくなる
  it.each(ALL_SOUNDS)('%s の総尺が上限以内', (_name, sound) => {
    expect(durationOf(sound)).toBeGreaterThan(0)
    expect(durationOf(sound)).toBeLessThanOrEqual(MAX_SOUND_SEC)
  })

  // 同時に鳴る音量の合計が 1.0 を超えるとクリップして歪む
  it.each(ALL_SOUNDS)('%s がクリップしない', (_name, sound) => {
    expect(peakGain(sound)).toBeLessThanOrEqual(1)
  })
})

describe('durationOf / peakGain', () => {
  it('総尺は delay + attack + decay の最大', () => {
    const s: Sound = {
      voices: [
        { wave: 'sine', freq: 440, gain: 0.1, attack: 0.01, decay: 0.1 },
        { wave: 'sine', freq: 440, gain: 0.1, attack: 0.02, decay: 0.2, delay: 0.5 },
      ],
    }
    expect(durationOf(s)).toBeCloseTo(0.72)
  })

  it('重ならない音は合計されない', () => {
    const s: Sound = {
      voices: [
        { wave: 'sine', freq: 440, gain: 0.6, attack: 0.01, decay: 0.05 },
        { wave: 'sine', freq: 440, gain: 0.6, attack: 0.01, decay: 0.05, delay: 0.5 },
      ],
    }
    expect(peakGain(s)).toBeCloseTo(0.6)
  })

  it('重なる音は合計される', () => {
    const s: Sound = {
      voices: [
        { wave: 'sine', freq: 440, gain: 0.6, attack: 0.01, decay: 0.5 },
        { wave: 'sine', freq: 440, gain: 0.6, attack: 0.01, decay: 0.5, delay: 0.1 },
      ],
    }
    expect(peakGain(s)).toBeCloseTo(1.2)
  })
})

describe('dampen：不発の湿った音', () => {
  it('音量が下がり減衰が縮む', () => {
    const before = CARD_SOUNDS.uzushio
    const after = dampen(before)
    for (const [i, v] of after.voices.entries()) {
      expect(v.gain).toBeLessThan(before.voices[i].gain)
      expect(v.decay).toBeLessThan(before.voices[i].decay)
    }
  })

  it('0 や負の値を作らない', () => {
    for (const id of CARD_ORDER) {
      for (const v of dampen(CARD_SOUNDS[id]).voices) {
        expect(v.gain, id).toBeGreaterThan(0)
        expect(v.decay, id).toBeGreaterThan(0)
      }
    }
  })

  it('掃引の幅も詰まる', () => {
    const before = CARD_SOUNDS.dangai.voices[0]
    const after = dampen(CARD_SOUNDS.dangai).voices[0]
    expect(before.toFreq).toBeDefined()
    // 400 → 70 が 400 → 235 になる（落差が半分）
    expect(after.toFreq).toBeCloseTo(235)
  })

  it('掃引のない音に toFreq を生やさない', () => {
    expect(dampen(CARD_SOUNDS.gekko).voices[0].toFreq).toBeUndefined()
  })
})

describe('soundForEvent', () => {
  it('演出イベントがなければ鳴らさない', () => {
    expect(soundForEvent(null)).toBeNull()
  })

  it('置いたカードの音が返る', () => {
    for (const id of CARD_ORDER) {
      expect(soundForEvent(event({ cardId: id }))).toEqual(CARD_SOUNDS[id])
    }
  })

  it('不発なら湿った音になる（同じカードだと分かる形で）', () => {
    const normal = soundForEvent(event({ cardId: 'uzushio' }))
    const fizzled = soundForEvent(event({ cardId: 'uzushio', fizzled: true }))
    expect(fizzled).not.toEqual(normal)
    expect(fizzled).toEqual(dampen(CARD_SOUNDS.uzushio))
    // 声の数は変わらない＝別の音に差し替わっていない
    expect(fizzled?.voices).toHaveLength(CARD_SOUNDS.uzushio.voices.length)
  })

  it('捨札も湿った音になる', () => {
    const s = soundForEvent(event({ cardId: 'dangai', discardOnly: true }))
    expect(s).toEqual(dampen(CARD_SOUNDS.dangai))
  })

  it('湿らせても上限とクリップの条件を満たす', () => {
    for (const id of CARD_ORDER) {
      const s = dampen(CARD_SOUNDS[id])
      expect(durationOf(s), id).toBeLessThanOrEqual(MAX_SOUND_SEC)
      expect(peakGain(s), id).toBeLessThanOrEqual(1)
    }
  })
})
