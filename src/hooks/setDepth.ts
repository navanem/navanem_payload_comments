import type { CollectionBeforeChangeHook } from 'payload'
import type { CollectionSlug } from 'payload'

/**
 * Pure resolver for a comment's depth.
 * `parentDepth` is null for a top-level comment, otherwise the parent's depth.
 * Throws if the resulting depth would exceed maxDepth (1..3 levels => depths 0..maxDepth-1).
 */
export function resolveDepth(parentDepth: number | null, maxDepth: number): number {
  if (parentDepth === null) return 0
  const depth = parentDepth + 1
  if (depth > maxDepth - 1) {
    throw new Error(`Reply exceeds the maximum nesting depth of ${maxDepth} levels.`)
  }
  return depth
}

/** Hook factory: computes and validates depth from the parent comment. */
export function setDepth(commentsSlug: string, maxDepth: number): CollectionBeforeChangeHook {
  return async ({ data, req, operation }) => {
    if (operation !== 'create') return data
    if (!data.parent) {
      data.depth = 0
      return data
    }
    const parent = await req.payload.findByID({
      collection: commentsSlug as CollectionSlug,
      id: data.parent,
      depth: 0,
    })

    // A reply must belong to the same document as the parent it answers.
    if (data.relatedDoc) {
      const parentRelated = parent.relatedDoc as { relationTo?: string; value?: unknown } | undefined
      const childRelated = data.relatedDoc as { relationTo?: string; value?: unknown }
      if (
        parentRelated?.relationTo !== childRelated.relationTo ||
        Number(parentRelated?.value) !== Number(childRelated.value)
      ) {
        throw new Error('Reply must belong to the same document as its parent.')
      }
    }

    data.depth = resolveDepth(typeof parent.depth === 'number' ? parent.depth : 0, maxDepth)
    return data
  }
}
