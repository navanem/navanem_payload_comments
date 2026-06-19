import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getPayload, type Payload } from 'payload'
import config from '../../dev/payload.config.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.resolve(dirname, '../../dev/test.db')

let instance: Payload | null = null

/** Get a shared Payload instance for tests. */
export async function getTestPayload(): Promise<Payload> {
  if (instance) return instance
  // Start from a clean schema: libsql `:memory:` is unreliable across connections,
  // so we use a file-based DB and delete any leftover files before booting so the
  // adapter's schema push always builds the current schema from scratch.
  for (const suffix of ['', '-shm', '-wal']) {
    const file = `${dbPath}${suffix}`
    if (fs.existsSync(file)) fs.rmSync(file)
  }
  instance = await getPayload({ config })
  return instance
}

/** Remove all comments and reactions between tests. */
export async function clearComments(payload: Payload): Promise<void> {
  await payload.delete({ collection: 'comment-reactions', where: { id: { exists: true } } })
  await payload.delete({ collection: 'comments', where: { id: { exists: true } } })
}

/** Create a post and return its id. */
export async function createPost(payload: Payload, title = 'Test Post'): Promise<string> {
  const post = await payload.create({ collection: 'posts', data: { title } })
  return String(post.id)
}

/**
 * Set the runtime moderation toggle on the Comments Settings global. Since the
 * submit flow now reads `requireApproval` live from this global (seeded from the
 * plugin option), tests that depend on a comment's status drive it through here.
 */
export async function setRequireApproval(payload: Payload, value: boolean): Promise<void> {
  await payload.updateGlobal({
    slug: 'comments-settings',
    data: { requireApproval: value },
    overrideAccess: true,
  })
}
