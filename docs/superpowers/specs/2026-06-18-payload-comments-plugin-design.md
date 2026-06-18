# @navanem/payload-comments — Design

**Date:** 2026-06-18
**Status:** Approved, ready for implementation planning
**Target:** Payload 3.x

## Goal

A Payload comment-management plugin - Payload and easy to deploy on any Payload 3.x project.

v1 scope (no authentication):

- Anyone can leave a comment (name + email) with a reaction icon ("mood")
  attached to their own comment.
- Anyone can react to an existing comment using an emoji set.
- Pre-publish moderation that can be turned on or off.
- Nested replies, **maximum 3 levels**.
- Minimal built-in anti-spam.
- Ready-to-use React front-end component, plus a front-end integration guide in
  the docs.

## 1. Architecture

Scoped npm package **`@navanem/payload-comments`** (TypeScript), based on the
official Payload *plugin template* structure:

- `src/` — plugin code
- `dev/` — small Payload app for local development and testing

The plugin is a `commentsPlugin(options)` function that returns
`(config) => config` and injects collections, endpoints, access control and
hooks without breaking the host config. Respects `disabled: true` (no-op), a
Payload convention.

Distribution strategy: package prepared for npm (build, clean exports),
installable via Git until eventually published.

**Package exports:**

- `@navanem/payload-comments` → the plugin function (back end)
- `@navanem/payload-comments/client` → the `<Comments />` React component (`'use client'`)
- `@navanem/payload-comments/types` → shared types

`payload`, `react`, `next` are **peerDependencies**.

## 2. Data model

### `comments` collection (slug configurable via `commentsSlug`)

| Field | Type | Notes |
|-------|------|-------|
| `content` | textarea | required, min/max length |
| `authorName` | text | required |
| `authorEmail` | email | **admin read only**, never exposed publicly; required if `requireEmail` |
| `mood` | select | emoji set = reaction (A) attached by the author to their comment |
| `status` | select | `pending \| approved \| spam \| trash`, default from `requireApproval` |
| `relatedDoc` | polymorphic relationship | `relationTo: enabledCollections` + `value` |
| `parent` | relationship → `comments` (self) | threading |
| `depth` | number | 0–2 (3 levels max), computed and **validated** server-side |
| `reactionCounts` | json/group | denormalized counts per emoji (fast-read cache) |
| `ipHash` | text | salted hash, never clear-text IP, admin only |
| `fingerprintHash` | text | salted hash, admin only |

### `comment-reactions` collection (lightweight, grouped in admin)

Fields: `comment`, `emoji`, `ipHash`, `fingerprintHash`.

Source of truth for reactions (B); enables de-duplication and recomputing the
counts. `comments.reactionCounts` is a cache derived from this collection.

## 3. Public endpoints (custom REST)

- `GET /api/comments/tree?relationTo=&docId=` — tree of **approved** comments
  only (≤ 3 levels), `authorEmail` excluded from the response.
- `POST /api/comments/submit` — anonymous submission: honeypot, per-`ipHash`
  rate limit, min/max length, optional link blocking, depth validation. Returns
  the published comment, or an "awaiting moderation" message.
- `POST /api/comments/:id/react` — adds/removes a reaction (B), de-duplicated by
  `ipHash + fingerprintHash`, updates `reactionCounts`. Always immediate (not moderated).

Direct creation via the collection's standard REST API is **closed to the
public**: submission must go through `/submit` to enforce anti-spam.

## 4. Access control & anti-spam

**Access:**

- Public `read`: only `status = approved`. Admins: everything.
- `create`: disabled for the public (endpoint only).
- `update` / `delete`: admins only.

**Built-in anti-spam v1:**

- Honeypot (hidden field).
- Rate limiting per `ipHash` (configurable window + max, in-memory store).
- Min/max content length.
- Optional link blocking.
- Salted IP/fingerprint hashing (`ipSalt` or env var) — no clear-text IP stored.
- Honest about its limits: deterrent without login, not foolproof. No third-party
  service (Akismet, etc.) in v1.

## 5. Configuration options

```ts
commentsPlugin({
  enabledCollections: ['posts', 'pages'], // required
  requireApproval: true,        // default true → new comments are `pending`
  requireEmail: false,
  maxDepth: 3,                  // 1..3
  reactions: DEFAULT_REACTIONS, // 👍 ❤️ 😂 😮 😢 👎, overridable
  maxLength: 2000,
  minLength: 2,
  blockLinks: false,
  rateLimit: { windowMs: 60000, max: 5 },
  commentsSlug: 'comments',     // avoids collisions
  ipSalt: process.env.COMMENTS_IP_SALT,
  disabled: false,
})
```

The same `reactions` set is used for the mood (A) and for reactions on comments (B).

## 6. Front-end component `<Comments />`

Styled React client component (`'use client'`), drop-in for a Next.js front end:

```tsx
<Comments serverURL="https://example.com" relationTo="posts" docId={post.id} />
```

Handles: tree fetching, nested rendering (≤ 3 levels), submission form (name,
email if required, text, mood picker, hidden honeypot), and reaction buttons on
each comment.

- **No heavy dependency.**
- Styles via CSS Modules + overridable CSS variables (themeable).
- Optional: integrators can rebuild everything from the endpoints.

## 7. Admin visual fidelity

Relies on **native Payload field types and components**: badge select for status,
list filters, field groups, custom list columns. No exotic UI layer. The
"Comments" view offers a status filter and approve / spam / trash actions through
native mechanisms. `comment-reactions` is grouped in the admin to avoid clutter.

## 8. Repo structure

```
src/                 # plugin (collections, endpoints, access, hooks, utils, client)
dev/                 # Payload dev/test app
docs/                # configuration.md, frontend-integration.md, moderation.md
docs/superpowers/specs/  # this design
README.md            # install + quickstart + link to docs
CHANGELOG.md         # Keep a Changelog, SemVer, starting at v0.1.0
.gitignore           # node_modules, dist, .env, etc.
LICENSE              # MIT
package.json         # exports map, peerDeps, build scripts (tsc)
```

## 9. Tests

Integration tests on the `dev/` app (TDD approach) covering at least:

- Depth ≤ 3 enforced (rejection beyond).
- Status defaults from `requireApproval`.
- Reaction de-duplication by `ipHash + fingerprintHash`.
- Anti-spam (honeypot, rate limit, length, links).
- Access: public sees only `approved`, `authorEmail` never exposed.

## 10. Versioning & conventions

- **SemVer** + `CHANGELOG.md` (Keep a Changelog format), git tags `vX.Y.Z`,
  starting at `0.1.0`.
- **License: MIT.**
- **Commits:** author `navanem <tools@sunitech.ch>`. No AI-assistant
  attribution anywhere (code, comments, README, CHANGELOG, or co-author).

## Out of scope for v1 (future)

- Authentication / member-linked comments.
- Email notifications, Gravatar.
- Third-party anti-spam services (Akismet).
- Embeddable JS widget for non-Next sites (`<script>` + iframe).
