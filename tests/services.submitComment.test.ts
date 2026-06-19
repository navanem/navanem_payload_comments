import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import type { Payload } from 'payload'
import { getTestPayload, clearComments, createPost, setRequireApproval } from './helpers/payload.js'
import { submitComment } from '../src/services/submitComment.js'
import { resolveOptions } from '../src/defaults.js'

let payload: Payload
const options = resolveOptions({ enabledCollections: ['posts'], requireApproval: true })

beforeAll(async () => {
  payload = await getTestPayload()
})
beforeEach(async () => {
  await clearComments(payload)
})

describe('submitComment', () => {
  it('creates a pending top-level comment when approval is required', async () => {
    await setRequireApproval(payload, true)
    const postId = await createPost(payload)
    const result = await submitComment(payload, options, {
      content: 'Nice article',
      authorName: 'Alice',
      authorEmail: 'alice@example.com',
      mood: 'like',
      relatedDoc: { relationTo: 'posts', value: postId },
      parent: null,
      ipHash: 'iphash',
      fingerprintHash: 'fphash',
    })
    expect(result.status).toBe('pending')
    expect(result.depth).toBe(0)
    expect(result.content).toBe('Nice article')
  })

  it('creates an approved comment when approval not required', async () => {
    await setRequireApproval(payload, false)
    const noApproval = resolveOptions({ enabledCollections: ['posts'], requireApproval: false })
    const postId = await createPost(payload)
    const result = await submitComment(payload, noApproval, {
      content: 'Instant',
      authorName: 'Bob',
      mood: null,
      relatedDoc: { relationTo: 'posts', value: postId },
      parent: null,
      ipHash: '',
      fingerprintHash: '',
    })
    expect(result.status).toBe('approved')
  })

  it('sets depth to 1 for a reply', async () => {
    const postId = await createPost(payload)
    const parent = await submitComment(payload, options, {
      content: 'Parent',
      authorName: 'A',
      mood: null,
      relatedDoc: { relationTo: 'posts', value: postId },
      parent: null,
      ipHash: '',
      fingerprintHash: '',
    })
    const reply = await submitComment(payload, options, {
      content: 'Child',
      authorName: 'B',
      mood: null,
      relatedDoc: { relationTo: 'posts', value: postId },
      parent: String(parent.id),
      ipHash: '',
      fingerprintHash: '',
    })
    expect(reply.depth).toBe(1)
  })

  it('rejects a reply deeper than maxDepth', async () => {
    const postId = await createPost(payload)
    let parentId: string | null = null
    // build depths 0,1,2 (3 levels)
    for (let i = 0; i < 3; i++) {
      const c = await submitComment(payload, options, {
        content: `level ${i}`,
        authorName: 'X',
        mood: null,
        relatedDoc: { relationTo: 'posts', value: postId },
        parent: parentId,
        ipHash: '',
        fingerprintHash: '',
      })
      parentId = String(c.id)
    }
    // a 4th level must fail
    await expect(
      submitComment(payload, options, {
        content: 'too deep',
        authorName: 'X',
        mood: null,
        relatedDoc: { relationTo: 'posts', value: postId },
        parent: parentId,
        ipHash: '',
        fingerprintHash: '',
      }),
    ).rejects.toThrow(/maximum nesting depth/i)
  })

  it('rejects a reply whose parent belongs to a different document', async () => {
    const postA = await createPost(payload, 'Post A')
    const postB = await createPost(payload, 'Post B')
    const parent = await submitComment(payload, options, {
      content: 'parent on A', authorName: 'A', mood: null,
      relatedDoc: { relationTo: 'posts', value: postA },
      parent: null, ipHash: '', fingerprintHash: '',
    })
    await expect(
      submitComment(payload, options, {
        content: 'reply claiming B', authorName: 'B', mood: null,
        relatedDoc: { relationTo: 'posts', value: postB },
        parent: String(parent.id), ipHash: '', fingerprintHash: '',
      }),
    ).rejects.toThrow(/same document as its parent/i)
  })
})
