import type { Payload } from 'payload'
import type { ResolvedOptions } from '../types.js'
import { COMMENTS_SETTINGS_SLUG } from '../globals/CommentsSettings.js'

/**
 * Resolve the set of collections that currently accept comments, combining the
 * static `enabledCollections` option with the runtime Comments Settings global.
 *
 * Fail-open: if the global has never been saved (returns its defaults) or the
 * table does not exist yet (pre-migration), every configured collection is
 * treated as enabled.
 */
export async function getEnabledCollections(
  payload: Payload,
  options: ResolvedOptions,
): Promise<string[]> {
  const fallback = options.enabledCollections.map(String)
  try {
    const settings = await payload.findGlobal({
      slug: COMMENTS_SETTINGS_SLUG,
      depth: 0,
      overrideAccess: true,
    })
    const enabled = (settings as { enabledCollections?: unknown })?.enabledCollections
    if (Array.isArray(enabled)) return enabled.map(String)
    return fallback
  } catch {
    return fallback
  }
}

/** Convenience guard: is `relationTo` currently enabled for comments? */
export async function isCommentingEnabled(
  payload: Payload,
  options: ResolvedOptions,
  relationTo: string,
): Promise<boolean> {
  const enabled = await getEnabledCollections(payload, options)
  return enabled.includes(relationTo)
}

/**
 * Resolve whether new comments require admin approval, from the runtime Comments
 * Settings global, falling back to the static `requireApproval` option. Fail-open
 * to the option when the global is unsaved (returns defaults) or the table does
 * not exist yet (pre-migration).
 */
export async function getRequireApproval(payload: Payload, options: ResolvedOptions): Promise<boolean> {
  try {
    const settings = await payload.findGlobal({
      slug: COMMENTS_SETTINGS_SLUG,
      depth: 0,
      overrideAccess: true,
    })
    const value = (settings as { requireApproval?: unknown })?.requireApproval
    return typeof value === 'boolean' ? value : Boolean(options.requireApproval)
  } catch {
    return Boolean(options.requireApproval)
  }
}
