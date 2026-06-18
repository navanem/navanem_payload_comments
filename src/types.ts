import type { CollectionSlug } from 'payload'

/** A single reaction definition (used both for comment "mood" and for reactions on comments). */
export interface Reaction {
  /** Stable identifier stored in the database, e.g. "like". */
  key: string
  /** Emoji or short symbol shown in the UI, e.g. "👍". */
  emoji: string
  /** Human-readable label for accessibility, e.g. "Like". */
  label: string
}

/** Status values for a comment. */
export type CommentStatus = 'pending' | 'approved' | 'spam' | 'trash'

/** Options accepted by commentsPlugin(). */
export interface CommentsPluginOptions {
  /** Collections whose documents can be commented on. Required. */
  enabledCollections: CollectionSlug[]
  /** When true, new comments start as "pending" and are hidden until approved. Default: true. */
  requireApproval?: boolean
  /** When true, authorEmail is required on submit. Default: false. */
  requireEmail?: boolean
  /** Maximum nesting depth, 1..3. Default: 3. */
  maxDepth?: 1 | 2 | 3
  /** Reaction set, used for both comment mood and reactions on comments. */
  reactions?: Reaction[]
  /** Maximum content length in characters. Default: 2000. */
  maxLength?: number
  /** Minimum content length in characters. Default: 2. */
  minLength?: number
  /** When true, comments containing URLs are rejected. Default: false. */
  blockLinks?: boolean
  /** Sliding-window rate limit per hashed IP. Default: { windowMs: 60000, max: 5 }. */
  rateLimit?: { windowMs: number; max: number }
  /** Slug for the comments collection. Default: "comments". */
  commentsSlug?: string
  /** Slug for the reactions collection. Default: "comment-reactions". */
  reactionsSlug?: string
  /** Salt used to hash IPs and fingerprints. Falls back to COMMENTS_IP_SALT env var. */
  ipSalt?: string
  /** When true, the plugin is a no-op (collections still added so DB schema is stable). Default: false. */
  disabled?: boolean
}

/** Fully-resolved options after defaults are applied. */
export interface ResolvedOptions extends Required<Omit<CommentsPluginOptions, 'ipSalt' | 'disabled'>> {
  ipSalt: string
  disabled: boolean
}
