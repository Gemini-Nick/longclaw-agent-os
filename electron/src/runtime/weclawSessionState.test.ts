import { describe, expect, it } from 'vitest'

import {
  canonicalWeclawSessionId,
  mergeWeclawSessionUiFlags,
  normalizeWeclawSessionUiState,
} from './weclawSessionState.js'

describe('weclawSessionState', () => {
  it('prefers canonical metadata when deriving the canonical session id', () => {
    expect(
      canonicalWeclawSessionId({
        sessionId: 'session-1',
        userId: 'wx-user',
        title: 'fallback title',
        canonicalMetadata: {
          canonical_session_id: 'wechat-thread:alpha',
        },
      }),
    ).toBe('canonical:wechat-thread-alpha')
  })

  it('merges hidden and archived flags without mutating unrelated sessions', () => {
    const initial = normalizeWeclawSessionUiState({
      'canonical:a': { hidden: false, archived: false, updated_at: '2026-01-01T00:00:00Z' },
    })

    const next = mergeWeclawSessionUiFlags(initial, 'canonical:b', { hidden: true })
    const final = mergeWeclawSessionUiFlags(next, 'canonical:a', { archived: true })

    expect(final['canonical:b']?.hidden).toBe(true)
    expect(final['canonical:b']?.archived).toBe(false)
    expect(final['canonical:a']?.hidden).toBe(false)
    expect(final['canonical:a']?.archived).toBe(true)
  })
})
