// 効果音の ON/OFF と再生を App から使うための接着。
//
// 演出トグル（multiply:fx）とは独立させてある。視差を減らしたい人と音を消したい
// 人は別なので、prefers-reduced-motion にも連動させない。
import { useCallback, useEffect, useState } from 'react'
import { playSound, setSoundEnabled, unlockAudioOnGesture } from './sound.ts'
import type { Sound, UiSound } from './soundSpec.ts'
import { UI_SOUNDS } from './soundSpec.ts'

/** 効果音の ON/OFF を次回起動まで覚えておく */
const SOUND_KEY = 'multiply:sound'

function initialSoundOn(): boolean {
  if (typeof window === 'undefined') return true
  // 既定は ON。操作のフィードバックとして役に立つほうが大きい
  return window.localStorage.getItem(SOUND_KEY) !== 'off'
}

export interface SoundControls {
  soundOn: boolean
  toggleSound: (on: boolean) => void
  /** 任意の音を鳴らす（カードの音など） */
  play: (sound: Sound | null) => void
  /** 名前で操作音を鳴らす */
  playUi: (name: UiSound) => void
}

export function useSound(): SoundControls {
  const [soundOn, setSoundOn] = useState(initialSoundOn)

  // 起動時に一度だけ、最初のユーザー操作を待って AudioContext を起こす
  useEffect(() => unlockAudioOnGesture(), [])

  // 初期値をエンジンへ伝える。localStorage が off なら鳴らさない状態から始まる
  useEffect(() => {
    setSoundEnabled(soundOn)
  }, [soundOn])

  const toggleSound = useCallback((on: boolean) => {
    setSoundOn(on)
    if (typeof window !== 'undefined') window.localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
  }, [])

  const play = useCallback((sound: Sound | null) => playSound(sound), [])
  const playUi = useCallback((name: UiSound) => playSound(UI_SOUNDS[name]), [])

  return { soundOn, toggleSound, play, playUi }
}
