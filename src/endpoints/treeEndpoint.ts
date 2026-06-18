import type { Endpoint, PayloadRequest } from 'payload'
import type { ResolvedOptions } from '../types.js'
import { getCommentTree } from '../services/getCommentTree.js'

export function treeEndpoint(options: ResolvedOptions): Endpoint {
  return {
    path: '/comments-api/tree',
    method: 'get',
    handler: async (req: PayloadRequest) => {
      const relationTo = req.searchParams.get('relationTo') ?? ''
      const docId = req.searchParams.get('docId') ?? ''
      if (!relationTo || !docId) {
        return Response.json({ error: 'relationTo and docId are required' }, { status: 400 })
      }
      if (!options.enabledCollections.includes(relationTo as never)) {
        return Response.json({ error: 'Collection not enabled for comments' }, { status: 400 })
      }
      const comments = await getCommentTree(req.payload, options, { relationTo, docId })
      return Response.json({ comments })
    },
  }
}
