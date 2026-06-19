# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-06-19

### Added

- **Markdown comments**: comment bodies render a safe subset of Markdown (bold,
  italic, strikethrough, inline/block code, links, lists, blockquotes) via
  `react-markdown` + `remark-gfm`. Raw HTML is never rendered (no XSS); links are
  hardened with `rel="noopener noreferrer nofollow ugc"` and open in a new tab.
- **Moderation toggle in Settings**: the Comments Settings global gained a
  `requireApproval` checkbox to turn mandatory approval on/off at runtime. The
  submit flow reads it live, falling back to the `requireApproval` option.

## [0.2.0] - 2026-06-18

### Added

- **Comments Settings** global (admin group "Comments") to enable or disable
  commenting per collection at runtime. The submit and tree endpoints consult it
  and fail open when it has never been saved (or before its table is migrated).
- **Comment Statistics** admin view at `/admin/comments-statistics`: KPIs, per-
  collection and per-mood breakdowns, and recent comments, filterable by
  collection, status and period. Queries are auth-gated server-side so no data
  is rendered for anonymous requests. A nav link is registered via
  `afterNavLinks` for the default Nav.
- `<Comments />` now renders a "closed" notice when commenting is disabled for
  its collection.

## [0.1.1] - 2026-06-18

### Fixed

- Moved the public endpoints from `/comments/*` to `/comments-api/*` so they no
  longer collide with the comments collection's REST namespace in Payload 3.x
  (previously `GET /comments/tree` hit the collection `/:id` handler and `POST
  /comments/submit` returned 404). Component fetch URLs and the REST API docs
  were updated to match.
- Guarded the browser fingerprint on `window` so the component no longer crashes
  during server-side rendering on runtimes that define a global `navigator`.

## [0.1.0] - 2026-06-18

### Added

- `commentsPlugin()` for Payload 3.x: injects `comments` and `comment-reactions`
  collections plus public REST endpoints.
- Anonymous comment submission with name, optional/required email and a mood emoji.
- Reactions on comments with a configurable emoji set and toggle behavior.
- Optional pre-publish moderation via `requireApproval`.
- Up to 3 levels of nested replies, enforced server-side.
- Built-in anti-spam: honeypot, per-IP rate limiting, length and link rules.
- Salted hashing of IPs and fingerprints (no clear-text storage).
- Ready-to-use `<Comments />` React component and a documented REST API.

[0.1.1]: https://github.com/navanem/nanavanem_payload_comments/releases/tag/v0.1.1
[0.1.0]: https://github.com/navanem/nanavanem_payload_comments/releases/tag/v0.1.0
