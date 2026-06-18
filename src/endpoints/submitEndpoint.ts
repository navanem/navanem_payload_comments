import type { Endpoint, PayloadRequest } from 'payload'
import { addDataAndFileToRequest } from 'payload'
import type { ResolvedOptions } from '../types.js'
import { submitComment } from '../services/submitComment.js'
import { validateSubmission } from '../utils/validateContent.js'
import { getClientIdentity } from '../utils/getClientIdentity.js'
import { createRateLimiter } from '../utils/rateLimit.js'

export function submitEndpoint(options: ResolvedOptions): Endpoint {
  // One limiter instance per plugin registration (per server process).
  const limiter = createRateLimiter(options.rateLimit)

  return {
    path: '/comments/submit',
    method: 'post',
    handler: async (req: PayloadRequest) => {
      await addDataAndFileToRequest(req)
      const data = (req.data ?? {}) as Record<string, unknown>

      const identity = getClientIdentity({ headers: req.headers, body: data }, options.ipSalt)

      if (!limiter.check(identity.ipHash || 'anon')) {
        return Response.json({ error: 'Too many comments, please slow down.' }, { status: 429 })
      }

      const validation = validateSubmission(
        { content: String(data.content ?? ''), honeypot: String(data.honeypot ?? '') },
        { minLength: options.minLength, maxLength: options.maxLength, blockLinks: options.blockLinks },
      )
      if (!validation.ok) {
        const status = validation.reason === 'spam' ? 202 : 400
        // For honeypot spam, respond 202 so bots get no useful signal.
        return Response.json({ ok: validation.reason === 'spam', reason: validation.reason }, { status })
      }

      if (options.requireEmail && !data.authorEmail) {
        return Response.json({ error: 'Email is required.' }, { status: 400 })
      }

      const relatedDoc = data.relatedDoc as { relationTo?: string; value?: string } | undefined
      if (!relatedDoc?.relationTo || !relatedDoc?.value) {
        return Response.json({ error: 'relatedDoc is required.' }, { status: 400 })
      }
      if (!options.enabledCollections.includes(relatedDoc.relationTo as never)) {
        return Response.json({ error: 'Collection not enabled for comments.' }, { status: 400 })
      }

      try {
        const created = await submitComment(req.payload, options, {
          content: String(data.content),
          authorName: String(data.authorName ?? 'Anonymous'),
          authorEmail: data.authorEmail ? String(data.authorEmail) : undefined,
          mood: data.mood ? String(data.mood) : null,
          relatedDoc: { relationTo: relatedDoc.relationTo, value: relatedDoc.value },
          parent: data.parent ? String(data.parent) : null,
          ipHash: identity.ipHash,
          fingerprintHash: identity.fingerprintHash,
        })
        return Response.json({
          ok: true,
          status: created.status,
          pending: created.status === 'pending',
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not submit comment.'
        return Response.json({ error: message }, { status: 400 })
      }
    },
  }
}
