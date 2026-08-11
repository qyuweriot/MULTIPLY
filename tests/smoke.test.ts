import { describe, expect, it } from 'vitest'
import { ZONE_LABELS } from '../src/labels.ts'

describe('セットアップ', () => {
  it('src からの import が解決できる', () => {
    expect(Object.keys(ZONE_LABELS)).toEqual(['z0', 'z1'])
  })
})
