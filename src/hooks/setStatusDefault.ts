import type { CollectionBeforeChangeHook } from 'payload'
import type { CommentStatus } from '../types.js'

/** Pure resolver: returns the status a new comment should get. */
export function resolveStatus(current: CommentStatus | undefined, requireApproval: boolean): CommentStatus {
  if (current) return current
  return requireApproval ? 'pending' : 'approved'
}

/** Hook factory: sets the default status on create. */
export function setStatusDefault(requireApproval: boolean): CollectionBeforeChangeHook {
  return ({ data, operation }) => {
    if (operation === 'create') {
      data.status = resolveStatus(data.status, requireApproval)
    }
    return data
  }
}
