import type { GlobalConfig } from 'payload'
import type { ResolvedOptions } from '../types.js'

export const COMMENTS_SETTINGS_SLUG = 'comments-settings'

/**
 * Settings global for the comments plugin. Lets an admin enable or disable
 * commenting per collection at runtime (without a redeploy). All collections
 * configured via `enabledCollections` are on by default; unchecking one stops
 * new submissions and hides existing comments on that collection.
 */
export function buildCommentsSettings(options: ResolvedOptions): GlobalConfig {
  const collectionOptions = options.enabledCollections.map((slug) => ({
    label: String(slug),
    value: String(slug),
  }))

  return {
    slug: COMMENTS_SETTINGS_SLUG,
    label: 'Comments Settings',
    admin: {
      group: 'Comments',
      description: 'Enable or disable comments per collection, and require approval before publishing.',
    },
    access: {
      // Public read so the submit/tree endpoints can consult it for anonymous
      // visitors; only authenticated admins can change it.
      read: () => true,
      update: ({ req: { user } }) => Boolean(user),
    },
    fields: [
      {
        name: 'enabledCollections',
        type: 'select',
        hasMany: true,
        defaultValue: options.enabledCollections.map(String),
        options: collectionOptions,
        admin: {
          description:
            'Comments are accepted and shown only on the collections selected here. All collections are enabled by default.',
        },
      },
      {
        name: 'requireApproval',
        type: 'checkbox',
        defaultValue: options.requireApproval,
        label: 'Require approval before a comment is published',
        admin: {
          description:
            'When on, a new comment is held as "pending" until an admin approves it. When off, comments are published immediately.',
        },
      },
    ],
  }
}
