import type { Config } from 'payload'
import type { CommentsPluginOptions } from './types.js'
import { resolveOptions } from './defaults.js'
import { buildCommentsCollection } from './collections/Comments.js'
import { buildCommentReactionsCollection } from './collections/CommentReactions.js'
import { treeEndpoint } from './endpoints/treeEndpoint.js'
import { submitEndpoint } from './endpoints/submitEndpoint.js'
import { reactEndpoint } from './endpoints/reactEndpoint.js'
import { buildCommentsSettings } from './globals/CommentsSettings.js'

export type { CommentsPluginOptions, Reaction, CommentStatus } from './types.js'
export { DEFAULT_REACTIONS } from './defaults.js'

export const commentsPlugin =
  (pluginOptions: CommentsPluginOptions) =>
  (incomingConfig: Config): Config => {
    const options = resolveOptions(pluginOptions)
    const config = { ...incomingConfig }

    config.collections = [
      ...(config.collections ?? []),
      buildCommentsCollection(options),
      buildCommentReactionsCollection(options),
    ]

    // The settings global is always registered (stable DB schema), even when disabled.
    config.globals = [...(config.globals ?? []), buildCommentsSettings(options)]

    // When disabled, still register collections + global but skip endpoints/admin UI.
    if (options.disabled) return config

    config.endpoints = [
      ...(config.endpoints ?? []),
      treeEndpoint(options),
      submitEndpoint(options),
      reactEndpoint(options),
    ]

    // Admin: the Statistics view + a nav link to it. (Hosts with a custom Nav can
    // ignore the afterNavLinks entry and place the link themselves.) Component refs
    // resolve via the host importMap at the vendored path @/plugins/payload-comments.
    config.admin = {
      ...config.admin,
      components: {
        ...config.admin?.components,
        afterNavLinks: [
          ...(config.admin?.components?.afterNavLinks ?? []),
          '@/plugins/payload-comments/components/CommentsStatsNavLink#CommentsStatsNavLink',
        ],
        views: {
          ...config.admin?.components?.views,
          commentsStatistics: {
            Component: '@/plugins/payload-comments/components/CommentsStatsView#CommentsStatsView',
            path: '/comments-statistics',
          },
        },
      },
    }

    return config
  }

export default commentsPlugin
