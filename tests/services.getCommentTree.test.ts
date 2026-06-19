import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import type { Payload } from 'payload'
import { getTestPayload, clearComments, createPost, setRequireApproval } from './helpers/payload.js'
import { submitComment } from '../src/services/submitComment.js'
import { getCommentTree } from '../src/services/getCommentTree.js'
import { resolveOptions } from '../src/defaults.js'

let payload: Payload
const options = resolveOptions({ enabledCollections: ['posts'], requireApproval: false })

beforeAll(async () => {
  payload = await getTestPayload()
})
beforeEach(async () => {
  await clearComments(payload)
  // Default this suite to immediate publication; the non-approved case flips it.
  await setRequireApproval(payload, false)
})

async function add(postId: string, content: string, parent: string | null = null) {
  return submitComment(payload, options, {
    content,
    authorName: 'A',
    authorEmail: 'secret@example.com',
    mood: null,
    relatedDoc: { relationTo: 'posts', value: postId },
    parent,
    ipHash: 'ip',
    fingerprintHash: 'fp',
  })
}

describe('getCommentTree', () => {
  it('returns approved comments nested by parent', async () => {
    const postId = await createPost(payload)
    const root = await add(postId, 'root')
    await add(postId, 'child', String(root.id))

    const tree = await getCommentTree(payload, options, { relationTo: 'posts', docId: postId })
    expect(tree).toHaveLength(1)
    expect(tree[0].content).toBe('root')
    expect(tree[0].replies).toHaveLength(1)
    expect(tree[0].replies[0].content).toBe('child')
  })

  it('excludes authorEmail, ipHash and fingerprintHash from output', async () => {
    const postId = await createPost(payload)
    await add(postId, 'root')
    const tree = await getCommentTree(payload, options, { relationTo: 'posts', docId: postId })
    expect(tree[0]).not.toHaveProperty('authorEmail')
    expect(tree[0]).not.toHaveProperty('ipHash')
    expect(tree[0]).not.toHaveProperty('fingerprintHash')
  })

  it('excludes non-approved comments', async () => {
    await setRequireApproval(payload, true)
    const approvalOpts = resolveOptions({ enabledCollections: ['posts'], requireApproval: true })
    const postId = await createPost(payload)
    await submitComment(payload, approvalOpts, {
      content: 'pending one',
      authorName: 'A',
      mood: null,
      relatedDoc: { relationTo: 'posts', value: postId },
      parent: null,
      ipHash: '',
      fingerprintHash: '',
    })
    const tree = await getCommentTree(payload, options, { relationTo: 'posts', docId: postId })
    expect(tree).toHaveLength(0)
  })
})
