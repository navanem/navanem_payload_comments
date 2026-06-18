import type { Endpoint, PayloadRequest } from 'payload'
import { addDataAndFileToRequest } from 'payload'
import type { ResolvedOptions } from '../types.js'
import { reactToComment } from '../services/reactToComment.js'
import { getClientIdentity } from '../utils/getClientIdentity.js'

export function reactEndpoint(options: ResolvedOptions): Endpoint {
  return {
    path: '/comments-api/:id/react',
    method: 'post',
    handler: async (req: PayloadRequest) => {
      await addDataAndFileToRequest(req)
      const data = (req.data ?? {}) as Record<string, unknown>
      const commentId = req.routeParams?.id ? String(req.routeParams.id) : ''
      const emoji = String(data.emoji ?? '')
      if (!commentId || !emoji) {
        return Response.json({ error: 'comment id and emoji are required' }, { status: 400 })
      }
      const identity = getClientIdentity({ headers: req.headers, body: data }, options.ipSalt)
      try {
        const result = await reactToComment(req.payload, options, {
          commentId,
          emoji,
          ipHash: identity.ipHash,
          fingerprintHash: identity.fingerprintHash,
        })
        return Response.json(result)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not react.'
        return Response.json({ error: message }, { status: 400 })
      }
    },
  }
}
