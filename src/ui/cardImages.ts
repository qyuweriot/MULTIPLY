// カード画像。src/assets に置いてあるので Vite が base パス解決とハッシュ付与を行う。
// ファイル名は CardId と一致させてある。
import type { CardId } from '../core/types.ts'

import ashikase from '../assets/cards/ashikase.png'
import dangai from '../assets/cards/dangai.png'
import gekko from '../assets/cards/gekko.png'
import hanmo from '../assets/cards/hanmo.png'
import heigen from '../assets/cards/heigen.png'
import horaana from '../assets/cards/horaana.png'
import hyozan from '../assets/cards/hyozan.png'
import kagero from '../assets/cards/kagero.png'
import shippu from '../assets/cards/shippu.png'
import shiso from '../assets/cards/shiso.png'
import soyoku from '../assets/cards/soyoku.png'
import uzushio from '../assets/cards/uzushio.png'

export const CARD_IMAGES: Record<CardId, string> = {
  ashikase,
  dangai,
  gekko,
  hanmo,
  heigen,
  horaana,
  hyozan,
  kagero,
  shippu,
  shiso,
  soyoku,
  uzushio,
}

/** カード画像の縦横比（744 × 1039） */
export const CARD_ASPECT = 744 / 1039
