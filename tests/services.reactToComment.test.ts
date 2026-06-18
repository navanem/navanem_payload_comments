import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import type { Payload } from 'payload'
import { getTestPayload, clearComments, createPost } from './helpers/payload.js'
import { submitComment } from '../src/services/submitComment.js'
import { reactToComment } from '../src/services/reactToComment.js'
import { resolveOptions } from '../src/defaults.js'

let payload: Payload
const options = resolveOptions({ enabledCollections: ['posts'], requireApproval: false })

beforeAll(async () => {
  payload = await getTestPayload()
})
beforeEach(async () => {
  await clearComments(payload)
})

async function makeComment(postId: string) {
  return submitComment(payload, options, {
    content: 'react to me',
    authorName: 'A',
    mood: null,
    relatedDoc: { relationTo: 'posts', value: postId },
    parent: null,
    ipHash: '',
    fingerprintHash: '',
  })
}

describe('reactToComment', () => {
  it('adds a reaction and increments the count', async () => {
    const postId = await createPost(payload)
    const c = await makeComment(postId)
    const res = await reactToComment(payload, options, {
      commentId: String(c.id),
      emoji: 'like',
      ipHash: 'ip1',
      fingerprintHash: 'fp1',
    })
    expect(res.reactionCounts.like).toBe(1)
    expect(res.toggled).toBe('added')
  })

  it('removes the reaction when the same identity reacts again (toggle)', async () => {
    const postId = await createPost(payload)
    const c = await makeComment(postId)
    const identity = { commentId: String(c.id), emoji: 'like', ipHash: 'ip1', fingerprintHash: 'fp1' }
    await reactToComment(payload, options, identity)
    const res = await reactToComment(payload, options, identity)
    expect(res.reactionCounts.like ?? 0).toBe(0)
    expect(res.toggled).toBe('removed')
  })

  it('counts distinct identities separately', async () => {
    const postId = await createPost(payload)
    const c = await makeComment(postId)
    await reactToComment(payload, options, { commentId: String(c.id), emoji: 'like', ipHash: 'ip1', fingerprintHash: 'fp1' })
    const res = await reactToComment(payload, options, { commentId: String(c.id), emoji: 'like', ipHash: 'ip2', fingerprintHash: 'fp2' })
    expect(res.reactionCounts.like).toBe(2)
  })

  it('rejects an emoji not in the configured set', async () => {
    const postId = await createPost(payload)
    const c = await makeComment(postId)
    await expect(
      reactToComment(payload, options, { commentId: String(c.id), emoji: 'rocket', ipHash: 'ip', fingerprintHash: 'fp' }),
    ).rejects.toThrow(/unknown reaction/i)
  })

  it('rejects reacting to a non-approved comment', async () => {
    const approvalOpts = resolveOptions({ enabledCollections: ['posts'], requireApproval: true })
    const postId = await createPost(payload)
    const pending = await submitComment(payload, approvalOpts, {
      content: 'pending', authorName: 'A', mood: null,
      relatedDoc: { relationTo: 'posts', value: postId },
      parent: null, ipHash: '', fingerprintHash: '',
    })
    await expect(
      reactToComment(payload, options, { commentId: String(pending.id), emoji: 'like', ipHash: 'ip', fingerprintHash: 'fp' }),
    ).rejects.toThrow(/not available/i)
  })
})
