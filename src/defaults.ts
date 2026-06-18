import type { CommentsPluginOptions, Reaction, ResolvedOptions } from './types.js'

export const DEFAULT_REACTIONS: Reaction[] = [
  { key: 'like', emoji: '👍', label: 'Like' },
  { key: 'love', emoji: '❤️', label: 'Love' },
  { key: 'laugh', emoji: '😂', label: 'Laugh' },
  { key: 'wow', emoji: '😮', label: 'Wow' },
  { key: 'sad', emoji: '😢', label: 'Sad' },
  { key: 'dislike', emoji: '👎', label: 'Dislike' },
]

export function resolveOptions(options: CommentsPluginOptions): ResolvedOptions {
  return {
    enabledCollections: options.enabledCollections,
    requireApproval: options.requireApproval ?? true,
    requireEmail: options.requireEmail ?? false,
    maxDepth: options.maxDepth ?? 3,
    reactions: options.reactions ?? DEFAULT_REACTIONS,
    maxLength: options.maxLength ?? 2000,
    minLength: options.minLength ?? 2,
    blockLinks: options.blockLinks ?? false,
    rateLimit: options.rateLimit ?? { windowMs: 60000, max: 5 },
    commentsSlug: options.commentsSlug ?? 'comments',
    reactionsSlug: options.reactionsSlug ?? 'comment-reactions',
    ipSalt: options.ipSalt ?? process.env.COMMENTS_IP_SALT ?? 'payload-comments-default-salt',
    disabled: options.disabled ?? false,
  }
}
