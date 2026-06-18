import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import type { Payload } from 'payload'
import { getTestPayload, clearComments, createPost } from './helpers/payload.js'
import { submitComment } from '../src/services/submitComment.js'
import { resolveOptions } from '../src/defaults.js'

let payload: Payload
const approval = resolveOptions({ enabledCollections: ['posts'], requireApproval: true })

beforeAll(async () => {
  payload = await getTestPayload()
})
beforeEach(async () => {
  await clearComments(payload)
})

describe('public collection access', () => {
  it('hides non-approved comments from unauthenticated reads', async () => {
    const postId = await createPost(payload)
    await submitComment(payload, approval, {
      content: 'pending',
      authorName: 'A',
      mood: null,
      relatedDoc: { relationTo: 'posts', value: postId },
      parent: null,
      ipHash: '',
      fingerprintHash: '',
    })
    // overrideAccess:false simulates an anonymous request
    const result = await payload.find({
      collection: 'comments',
      overrideAccess: false,
      where: { 'relatedDoc.value': { equals: /^\d+$/.test(postId) ? Number(postId) : postId } },
    })
    expect(result.docs).toHaveLength(0)
  })

  it('shows approved comments to unauthenticated reads', async () => {
    const noApproval = resolveOptions({ enabledCollections: ['posts'], requireApproval: false })
    const postId = await createPost(payload)
    await submitComment(payload, noApproval, {
      content: 'approved',
      authorName: 'A',
      mood: null,
      relatedDoc: { relationTo: 'posts', value: postId },
      parent: null,
      ipHash: '',
      fingerprintHash: '',
    })
    const result = await payload.find({
      collection: 'comments',
      overrideAccess: false,
      where: { 'relatedDoc.value': { equals: /^\d+$/.test(postId) ? Number(postId) : postId } },
    })
    expect(result.docs).toHaveLength(1)
  })
})
