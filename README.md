# @navanem/payload-comments

Anonymous comments and reactions for Payload 3.x — with optional pre-publish
moderation, mood emojis, reactions on comments, and up to 3 levels of replies.

## Features

- Anyone can comment (name + optional/required email) with a mood emoji.
- Comment bodies support a safe subset of **Markdown** (bold, italic, code, links,
  lists, blockquotes); raw HTML is never rendered (no XSS).
- React to existing comments with a configurable emoji set.
- Optional approval workflow before comments are published — toggleable at runtime.
- Up to 3 levels of nested replies.
- Built-in lightweight anti-spam (honeypot, rate limiting, length/link rules).
- **Comments Settings** global: enable/disable comments per collection at runtime.
- **Comment Statistics** admin view: KPIs, per-collection and per-mood breakdowns, and recent comments, with filters.
- Ready-to-use `<Comments />` React component, or build your own on the REST API.

## Install

```bash
pnpm add @navanem/payload-comments
# or from Git until published:
pnpm add github:navanem/nanavanem_payload_comments
```

`payload`, `react` and `react-dom` are peer dependencies.

## Quick start

```ts
// payload.config.ts
import { commentsPlugin } from '@navanem/payload-comments'

export default buildConfig({
  // ...
  plugins: [
    commentsPlugin({
      enabledCollections: ['posts', 'pages'],
      requireApproval: true,
      requireEmail: false,
    }),
  ],
})
```

Set a salt for IP hashing in your environment:

```bash
COMMENTS_IP_SALT="a-long-random-string"
```

## Admin: Settings & Statistics

The plugin registers a **Comments Settings** global (admin group "Comments") where
an admin can toggle commenting per collection at runtime. When a collection is
disabled, new submissions are rejected and the `<Comments />` widget shows a
"closed" notice instead of the thread. Unset = every configured collection is
enabled (fail-open). The same global has a **Require approval** checkbox to turn
mandatory moderation on/off at runtime; the submit flow reads it live and falls
back to the `requireApproval` option.

It also registers a **Comment Statistics** view at `/admin/comments-statistics`
(KPIs, per-collection and per-mood breakdowns, and recent comments, filterable by
collection / status / period), plus a nav link to it via `afterNavLinks`. The view
queries moderation data server-side and is gated on an authenticated admin user.

The view and nav-link components are referenced through the host import map at the
vendored path `@/plugins/payload-comments/components/*`. If you vendor this plugin
under `src/plugins/payload-comments`, add the matching import-map entries (run
`payload generate:importmap`, or add them by hand). Hosts that ship a custom Nav
can ignore the `afterNavLinks` entry and place the Statistics link themselves.

## Front-end

```tsx
import { Comments } from '@navanem/payload-comments/client'

export default function PostPage({ post }) {
  return <Comments relationTo="posts" docId={post.id} />
}
```

See [docs/frontend-integration.md](docs/frontend-integration.md) for props, styling and a no-component (raw API) integration.

## Documentation

- [Configuration](docs/configuration.md)
- [Front-end integration](docs/frontend-integration.md)
- [Moderation](docs/moderation.md)

## License

MIT © navanem
