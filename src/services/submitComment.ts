import type { CollectionSlug, Payload } from 'payload'
import type { ResolvedOptions } from '../types.js'
import { getRequireApproval } from '../utils/getEnabledCollections.js'

export interface SubmitCommentInput {
  content: string
  authorName: string
  authorEmail?: string
  mood: string | null
  relatedDoc: { relationTo: string; value: string }
  parent: string | null
  ipHash: string
  fingerprintHash: string
}

/**
 * Create a comment via the Local API.
 * Depth validation is enforced by the collection's setDepth hook, so an
 * over-deep reply throws here (surfaced from that hook). The initial status is
 * derived from the per-call options (the collection's setStatusDefault hook is
 * fixed at boot, so passing it explicitly lets a caller override approval).
 */
export async function submitComment(payload: Payload, options: ResolvedOptions, input: SubmitCommentInput) {
  // Polymorphic relationship validation does not coerce a numeric-string id to the
  // collection's integer id type, so normalise it here (non-numeric values pass through).
  const relatedValue = /^\d+$/.test(input.relatedDoc.value)
    ? Number(input.relatedDoc.value)
    : input.relatedDoc.value
  const parentValue =
    input.parent != null && /^\d+$/.test(input.parent) ? Number(input.parent) : (input.parent ?? undefined)

  const requireApproval = await getRequireApproval(payload, options)

  return payload.create({
    collection: options.commentsSlug as CollectionSlug,
    data: {
      content: input.content,
      authorName: input.authorName,
      authorEmail: input.authorEmail,
      mood: input.mood ?? undefined,
      status: requireApproval ? 'pending' : 'approved',
      relatedDoc: { relationTo: input.relatedDoc.relationTo, value: relatedValue },
      parent: parentValue,
      ipHash: input.ipHash,
      fingerprintHash: input.fingerprintHash,
      reactionCounts: {},
    },
    overrideAccess: true,
  })
}
