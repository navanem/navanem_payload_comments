import type { CollectionSlug, Payload } from 'payload'
import type { ResolvedOptions } from '../types.js'

export interface ReactInput {
  commentId: string
  emoji: string
  ipHash: string
  fingerprintHash: string
}

export interface ReactResult {
  reactionCounts: Record<string, number>
  toggled: 'added' | 'removed'
}

/** Coerce a numeric-string id to a number (the DB stores integer ids); pass others through. */
function coerceId(id: string): string | number {
  return /^\d+$/.test(id) ? Number(id) : id
}

/**
 * Toggle a reaction for one identity on a comment, then recompute the
 * denormalized counts from the reactions collection (source of truth).
 */
export async function reactToComment(
  payload: Payload,
  options: ResolvedOptions,
  input: ReactInput,
): Promise<ReactResult> {
  const known = options.reactions.some((r) => r.key === input.emoji)
  if (!known) throw new Error(`Unknown reaction: ${input.emoji}`)

  const commentValue = coerceId(input.commentId)

  // Only existing, approved comments can receive reactions.
  let comment
  try {
    comment = await payload.findByID({
      collection: options.commentsSlug as CollectionSlug,
      id: commentValue,
      overrideAccess: true,
      depth: 0,
    })
  } catch {
    throw new Error('Comment is not available for reactions.')
  }
  if (!comment || comment.status !== 'approved') {
    throw new Error('Comment is not available for reactions.')
  }

  const existing = await payload.find({
    collection: options.reactionsSlug as CollectionSlug,
    where: {
      and: [
        { comment: { equals: commentValue } },
        { emoji: { equals: input.emoji } },
        { ipHash: { equals: input.ipHash } },
        { fingerprintHash: { equals: input.fingerprintHash } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  })

  let toggled: 'added' | 'removed'
  if (existing.docs.length > 0) {
    await payload.delete({
      collection: options.reactionsSlug as CollectionSlug,
      id: existing.docs[0].id,
      overrideAccess: true,
    })
    toggled = 'removed'
  } else {
    await payload.create({
      collection: options.reactionsSlug as CollectionSlug,
      data: {
        comment: commentValue,
        emoji: input.emoji,
        ipHash: input.ipHash,
        fingerprintHash: input.fingerprintHash,
      },
      overrideAccess: true,
    })
    toggled = 'added'
  }

  const counts = await recomputeCounts(payload, options, commentValue)
  await payload.update({
    collection: options.commentsSlug as CollectionSlug,
    id: coerceId(input.commentId),
    data: { reactionCounts: counts },
    overrideAccess: true,
  })

  return { reactionCounts: counts, toggled }
}

async function recomputeCounts(
  payload: Payload,
  options: ResolvedOptions,
  commentValue: string | number,
): Promise<Record<string, number>> {
  const { docs } = await payload.find({
    collection: options.reactionsSlug as CollectionSlug,
    where: { comment: { equals: commentValue } },
    limit: 0,
    overrideAccess: true,
  })
  const counts: Record<string, number> = {}
  for (const r of docs) {
    counts[r.emoji] = (counts[r.emoji] ?? 0) + 1
  }
  return counts
}
