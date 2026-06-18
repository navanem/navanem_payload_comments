import { describe, it, expect } from 'vitest'
import { resolveStatus } from '../src/hooks/setStatusDefault.js'
import { resolveDepth } from '../src/hooks/setDepth.js'

describe('resolveStatus', () => {
  it('defaults to pending when approval required', () => {
    expect(resolveStatus(undefined, true)).toBe('pending')
  })
  it('defaults to approved when approval not required', () => {
    expect(resolveStatus(undefined, false)).toBe('approved')
  })
  it('keeps an explicit status', () => {
    expect(resolveStatus('spam', true)).toBe('spam')
  })
})

describe('resolveDepth', () => {
  it('is 0 for a top-level comment', () => {
    expect(resolveDepth(null, 3)).toBe(0)
  })
  it('is parentDepth + 1 for a reply', () => {
    expect(resolveDepth(0, 3)).toBe(1)
    expect(resolveDepth(1, 3)).toBe(2)
  })
  it('throws when exceeding maxDepth', () => {
    // maxDepth 3 => valid depths are 0,1,2; a reply to depth 2 would be depth 3 => reject
    expect(() => resolveDepth(2, 3)).toThrow(/maximum nesting depth/i)
  })
})
