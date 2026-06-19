# Configuration

`commentsPlugin(options)` accepts:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabledCollections` | `string[]` | — (required) | Collections whose documents can be commented on. Defines the set; individual collections can then be toggled on/off at runtime (see below). |
| `requireApproval` | `boolean` | `true` | New comments start as `pending` and stay hidden until approved. Seeds the runtime **Require approval** toggle in the Comments Settings global, which then governs it live. |
| `requireEmail` | `boolean` | `false` | Require an email when submitting. |
| `maxDepth` | `1 \| 2 \| 3` | `3` | Maximum reply nesting depth. |
| `reactions` | `Reaction[]` | 6 defaults | Emoji set for both comment mood and reactions. |
| `maxLength` | `number` | `2000` | Maximum content length. |
| `minLength` | `number` | `2` | Minimum content length. |
| `blockLinks` | `boolean` | `false` | Reject comments containing URLs. |
| `rateLimit` | `{ windowMs, max }` | `{ 60000, 5 }` | Per-IP sliding-window submit limit. |
| `commentsSlug` | `string` | `'comments'` | Slug for the comments collection. |
| `reactionsSlug` | `string` | `'comment-reactions'` | Slug for the reactions collection. |
| `ipSalt` | `string` | `COMMENTS_IP_SALT` env | Salt used to hash IPs/fingerprints. |
| `disabled` | `boolean` | `false` | Register collections but skip endpoints. |

## Reaction shape

```ts
interface Reaction {
  key: string   // stored value, e.g. "like"
  emoji: string // shown in UI, e.g. "👍"
  label: string // accessibility label
}
```

The same set is used for the comment author's "mood" and for reactions on comments.

## Runtime per-collection toggle (Comments Settings)

`enabledCollections` is the *config-time* set of commentable collections. The
plugin also registers a **Comments Settings** global (admin group "Comments")
where an admin can enable or disable commenting per collection **at runtime**,
without redeploying.

- The `submit` and `tree` endpoints consult this global on every request.
- When a collection is disabled, new submissions are rejected and the
  `<Comments />` widget renders a "closed" notice instead of the thread.
- The global is **fail-open**: if it has never been saved (or before its table is
  migrated), every collection in `enabledCollections` is treated as enabled.

The same global also carries a **Require approval** checkbox (seeded from the
`requireApproval` option) that governs moderation at runtime — see
[moderation](./moderation.md).

## Admin statistics view

A **Comment Statistics** view is mounted at `/admin/comments-statistics` (KPIs,
per-collection and per-mood breakdowns, recent comments; filterable by
collection, status and period). It queries moderation data server-side and is
gated on an authenticated admin user, so nothing is rendered for anonymous
requests. A nav link is registered through `afterNavLinks` for the default Nav.

If you vendor the plugin under `src/plugins/payload-comments`, make sure the
admin import map resolves `@/plugins/payload-comments/components/*` (run
`payload generate:importmap`, or add the entries by hand). Hosts with a custom
Nav can ignore the `afterNavLinks` entry and link to the view themselves.

## Privacy

IP addresses and browser fingerprints are never stored in clear text — only
salted SHA-256 hashes, used for reaction de-duplication and rate limiting.
Set a stable, secret `COMMENTS_IP_SALT`.
