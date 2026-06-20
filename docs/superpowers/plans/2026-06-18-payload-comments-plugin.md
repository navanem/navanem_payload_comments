# @navanem/payload-comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@navanem/payload-comments`, a Payload 3.x plugin that lets anyone post comments (name + email + mood emoji) and react to comments, with optional pre-publish moderation and 3-level nesting, distributed as an npm-ready TypeScript package with a ready-to-use React front-end component.

**Architecture:** A `commentsPlugin(options)` function returns `(config) => config` and injects two collections (`comments`, `comment-reactions`), three public REST endpoints, access control and hooks. Business logic lives in a testable `services/` layer (pure functions taking the `payload` instance); endpoints are thin wrappers that extract request data, compute hashed IP/fingerprint, apply rate-limiting, then delegate to services. A `dev/` Payload app drives integration tests via the Local API using the SQLite adapter (no external DB).

**Tech Stack:** TypeScript, Payload 3.x, Next.js (peer), React (peer), `@payloadcms/db-sqlite` (dev/test), Vitest, CSS Modules.

---

## Conventions for every task

- Author all commits as `navanem <tools@sunitech.ch>` (git is already configured locally).
- **NEVER** add AI-assistant attribution anywhere (code, comments, commit messages, docs, co-author trailers).
- Use `pnpm` for all package commands.
- Run commands from the repo root: `C:/Users/emanu/Documents/GitHub/nanavanem_payload_comments`.

---

## File Structure

```
package.json                      # exports map, peerDeps, build scripts
tsconfig.json                     # base TS config (build)
tsconfig.dev.json                 # dev/test TS config
vitest.config.ts                  # test runner config
.gitignore
.npmignore
LICENSE                           # MIT
README.md
CHANGELOG.md
.npmrc                            # optional, engine-strict
src/
  index.ts                        # commentsPlugin() entry
  types.ts                        # PluginOptions, Reaction, public types
  defaults.ts                     # DEFAULT_REACTIONS, default option values
  collections/
    Comments.ts                   # buildCommentsCollection(options)
    CommentReactions.ts           # buildCommentReactionsCollection(options)
  hooks/
    setStatusDefault.ts           # status default from requireApproval
    setDepth.ts                   # compute + validate depth (<= maxDepth)
  services/
    submitComment.ts              # create comment (status, depth, sanitize)
    getCommentTree.ts             # fetch approved tree, strip email
    reactToComment.ts             # add/remove reaction, recompute counts
  endpoints/
    treeEndpoint.ts               # GET  /api/comments/tree
    submitEndpoint.ts             # POST /api/comments/submit
    reactEndpoint.ts              # POST /api/comments/:id/react
  utils/
    hash.ts                       # hashWithSalt(value, salt)
    rateLimit.ts                  # in-memory sliding window limiter
    validateContent.ts            # honeypot, length, link checks
    getClientIdentity.ts          # extract ip + fingerprint from req
  exports/
    client.ts                     # re-exports <Comments />
    types.ts                      # re-exports public types
  components/
    Comments.tsx                  # React client component
    Comments.module.css           # styles (CSS variables, themeable)
dev/
  payload.config.ts               # Payload app wiring the plugin
  collections/Posts.ts            # sample target collection
  collections/Users.ts            # admin users
  server.ts                       # optional next/standalone (not required for tests)
tests/
  helpers/payload.ts              # init + teardown payload test instance
  utils.hash.test.ts
  utils.rateLimit.test.ts
  utils.validateContent.test.ts
  services.submitComment.test.ts
  services.getCommentTree.test.ts
  services.reactToComment.test.ts
  collection.access.test.ts
docs/
  configuration.md
  frontend-integration.md
  moderation.md
```

---

## Task 1: Initialize package scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.dev.json`
- Create: `.gitignore`
- Create: `.npmignore`
- Create: `LICENSE`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@navanem/payload-comments",
  "version": "0.1.0",
  "description": "Anonymous comments and reactions plugin for Payload 3.x with optional moderation and 3-level threads.",
  "license": "MIT",
  "author": "navanem <tools@sunitech.ch>",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./client": {
      "types": "./dist/exports/client.d.ts",
      "default": "./dist/exports/client.js"
    },
    "./types": {
      "types": "./dist/exports/types.d.ts",
      "default": "./dist/exports/types.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "clean": "rimraf dist",
    "dev": "payload dev",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "peerDependencies": {
    "payload": "^3.0.0",
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  },
  "devDependencies": {
    "@payloadcms/db-sqlite": "^3.0.0",
    "@payloadcms/next": "^3.0.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "payload": "^3.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "rimraf": "^6.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  },
  "engines": {
    "node": ">=18.20.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"],
  "exclude": ["dist", "node_modules", "dev", "tests"]
}
```

- [ ] **Step 3: Create `tsconfig.dev.json`** (used by the dev app and tests, includes everything)

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true,
    "rootDir": "."
  },
  "include": ["src", "dev", "tests"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 4: Create `.gitignore`**

```gitignore
node_modules
dist
.env
.env.*
*.log
dev/*.db
dev/.next
coverage
.DS_Store
```

- [ ] **Step 5: Create `.npmignore`**

```gitignore
dev
tests
docs
src
tsconfig*.json
vitest.config.ts
.gitignore
*.db
coverage
```

- [ ] **Step 6: Create `LICENSE`** (MIT, copyright navanem)

```
MIT License

Copyright (c) 2026 navanem

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 7: Install dependencies**

Run: `pnpm install`
Expected: dependencies resolve, `node_modules` created, no peer errors that block install.

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json tsconfig.dev.json .gitignore .npmignore LICENSE pnpm-lock.yaml
git commit -m "chore: scaffold package, tsconfig, license"
```

---

## Task 2: Public types and defaults

**Files:**
- Create: `src/types.ts`
- Create: `src/defaults.ts`

- [ ] **Step 1: Create `src/types.ts`**

```ts
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
```

- [ ] **Step 2: Create `src/defaults.ts`**

```ts
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
```

- [ ] **Step 3: Commit**

```bash
git add src/types.ts src/defaults.ts
git commit -m "feat: add plugin option types and defaults"
```

---

## Task 3: Hashing utility (TDD)

**Files:**
- Create: `src/utils/hash.ts`
- Test: `tests/utils.hash.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/utils.hash.test.ts
import { describe, it, expect } from 'vitest'
import { hashWithSalt } from '../src/utils/hash.js'

describe('hashWithSalt', () => {
  it('produces a stable hex hash for the same input + salt', () => {
    const a = hashWithSalt('1.2.3.4', 'salt')
    const b = hashWithSalt('1.2.3.4', 'salt')
    expect(a).toBe(b)
    expect(a).toMatch(/^[a-f0-9]{64}$/)
  })

  it('changes when the salt changes', () => {
    expect(hashWithSalt('1.2.3.4', 'saltA')).not.toBe(hashWithSalt('1.2.3.4', 'saltB'))
  })

  it('returns empty string for empty input', () => {
    expect(hashWithSalt('', 'salt')).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/utils.hash.test.ts`
Expected: FAIL — cannot find module `../src/utils/hash.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/utils/hash.ts
import { createHash } from 'crypto'

/** One-way hash of a value with a salt. Returns empty string for empty input. */
export function hashWithSalt(value: string, salt: string): string {
  if (!value) return ''
  return createHash('sha256').update(`${salt}:${value}`).digest('hex')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/utils.hash.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/hash.ts tests/utils.hash.test.ts
git commit -m "feat: add salted hashing utility"
```

---

## Task 4: Rate-limit utility (TDD)

**Files:**
- Create: `src/utils/rateLimit.ts`
- Test: `tests/utils.rateLimit.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/utils.rateLimit.test.ts
import { describe, it, expect } from 'vitest'
import { createRateLimiter } from '../src/utils/rateLimit.js'

describe('createRateLimiter', () => {
  it('allows up to max requests in the window then blocks', () => {
    let now = 1000
    const clock = () => now
    const limiter = createRateLimiter({ windowMs: 1000, max: 2 }, clock)
    expect(limiter.check('k')).toBe(true)
    expect(limiter.check('k')).toBe(true)
    expect(limiter.check('k')).toBe(false)
  })

  it('resets after the window elapses', () => {
    let now = 1000
    const clock = () => now
    const limiter = createRateLimiter({ windowMs: 1000, max: 1 }, clock)
    expect(limiter.check('k')).toBe(true)
    expect(limiter.check('k')).toBe(false)
    now = 2500
    expect(limiter.check('k')).toBe(true)
  })

  it('tracks keys independently', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 1 }, () => 0)
    expect(limiter.check('a')).toBe(true)
    expect(limiter.check('b')).toBe(true)
    expect(limiter.check('a')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/utils.rateLimit.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/utils/rateLimit.ts
export interface RateLimitConfig {
  windowMs: number
  max: number
}

export interface RateLimiter {
  /** Returns true if the request is allowed, false if it exceeds the limit. */
  check(key: string): boolean
}

/**
 * In-memory sliding-window rate limiter.
 * `clock` is injectable for testing; defaults to Date.now.
 */
export function createRateLimiter(config: RateLimitConfig, clock: () => number = () => Date.now()): RateLimiter {
  const hits = new Map<string, number[]>()
  return {
    check(key: string): boolean {
      const now = clock()
      const windowStart = now - config.windowMs
      const recent = (hits.get(key) ?? []).filter((t) => t > windowStart)
      if (recent.length >= config.max) {
        hits.set(key, recent)
        return false
      }
      recent.push(now)
      hits.set(key, recent)
      return true
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/utils.rateLimit.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/rateLimit.ts tests/utils.rateLimit.test.ts
git commit -m "feat: add in-memory rate limiter"
```

---

## Task 5: Content validation utility (TDD)

**Files:**
- Create: `src/utils/validateContent.ts`
- Test: `tests/utils.validateContent.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/utils.validateContent.test.ts
import { describe, it, expect } from 'vitest'
import { validateSubmission } from '../src/utils/validateContent.js'

const base = { minLength: 2, maxLength: 100, blockLinks: false }

describe('validateSubmission', () => {
  it('accepts valid content', () => {
    expect(validateSubmission({ content: 'Hello', honeypot: '' }, base)).toEqual({ ok: true })
  })

  it('rejects when honeypot is filled', () => {
    expect(validateSubmission({ content: 'Hello', honeypot: 'bot' }, base)).toEqual({
      ok: false,
      reason: 'spam',
    })
  })

  it('rejects content shorter than minLength', () => {
    expect(validateSubmission({ content: 'a', honeypot: '' }, base)).toEqual({
      ok: false,
      reason: 'too_short',
    })
  })

  it('rejects content longer than maxLength', () => {
    const long = 'a'.repeat(101)
    expect(validateSubmission({ content: long, honeypot: '' }, base)).toEqual({
      ok: false,
      reason: 'too_long',
    })
  })

  it('rejects links when blockLinks is true', () => {
    expect(
      validateSubmission({ content: 'see http://x.com', honeypot: '' }, { ...base, blockLinks: true }),
    ).toEqual({ ok: false, reason: 'links_not_allowed' })
  })

  it('allows links when blockLinks is false', () => {
    expect(validateSubmission({ content: 'see http://x.com', honeypot: '' }, base)).toEqual({ ok: true })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/utils.validateContent.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/utils/validateContent.ts
export interface ValidationRules {
  minLength: number
  maxLength: number
  blockLinks: boolean
}

export interface SubmissionInput {
  content: string
  honeypot: string
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: 'spam' | 'too_short' | 'too_long' | 'links_not_allowed' }

const LINK_PATTERN = /(https?:\/\/|www\.)/i

export function validateSubmission(input: SubmissionInput, rules: ValidationRules): ValidationResult {
  if (input.honeypot && input.honeypot.trim() !== '') return { ok: false, reason: 'spam' }
  const content = input.content?.trim() ?? ''
  if (content.length < rules.minLength) return { ok: false, reason: 'too_short' }
  if (content.length > rules.maxLength) return { ok: false, reason: 'too_long' }
  if (rules.blockLinks && LINK_PATTERN.test(content)) return { ok: false, reason: 'links_not_allowed' }
  return { ok: true }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/utils.validateContent.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/validateContent.ts tests/utils.validateContent.test.ts
git commit -m "feat: add comment submission validation"
```

---

## Task 6: Collection hooks — status default and depth (TDD via pure helpers)

The collection hooks delegate to pure functions so they can be unit-tested without a DB.

**Files:**
- Create: `src/hooks/setStatusDefault.ts`
- Create: `src/hooks/setDepth.ts`
- Test: `tests/hooks.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/hooks.test.ts
import { describe, it, expect } from 'vitest'
import { resolveStatus } from '../src/hooks/setStatusDefault.js'
import { resolveDepth } from '../src/hooks/setDepth.js'

describe('resolveStatus', () => {
  it('defaults to pending when approval required', () => {
    expect(resolveStatus(undefined, true)).toBe('pending')
  })
  it('defaults to approved when approval not required', () => {
    expect(resolveStatus(undefined, false)).toBe('approved')
  })
  it('keeps an explicit status', () => {
    expect(resolveStatus('spam', true)).toBe('spam')
  })
})

describe('resolveDepth', () => {
  it('is 0 for a top-level comment', () => {
    expect(resolveDepth(null, 3)).toBe(0)
  })
  it('is parentDepth + 1 for a reply', () => {
    expect(resolveDepth(0, 3)).toBe(1)
    expect(resolveDepth(1, 3)).toBe(2)
  })
  it('throws when exceeding maxDepth', () => {
    // maxDepth 3 => valid depths are 0,1,2; a reply to depth 2 would be depth 3 => reject
    expect(() => resolveDepth(2, 3)).toThrow(/maximum nesting depth/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/hooks.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write `src/hooks/setStatusDefault.ts`**

```ts
import type { CollectionBeforeChangeHook } from 'payload'
import type { CommentStatus } from '../types.js'

/** Pure resolver: returns the status a new comment should get. */
export function resolveStatus(current: CommentStatus | undefined, requireApproval: boolean): CommentStatus {
  if (current) return current
  return requireApproval ? 'pending' : 'approved'
}

/** Hook factory: sets the default status on create. */
export function setStatusDefault(requireApproval: boolean): CollectionBeforeChangeHook {
  return ({ data, operation }) => {
    if (operation === 'create') {
      data.status = resolveStatus(data.status, requireApproval)
    }
    return data
  }
}
```

- [ ] **Step 4: Write `src/hooks/setDepth.ts`**

```ts
import type { CollectionBeforeChangeHook } from 'payload'

/**
 * Pure resolver for a comment's depth.
 * `parentDepth` is null for a top-level comment, otherwise the parent's depth.
 * Throws if the resulting depth would exceed maxDepth (1..3 levels => depths 0..maxDepth-1).
 */
export function resolveDepth(parentDepth: number | null, maxDepth: number): number {
  if (parentDepth === null) return 0
  const depth = parentDepth + 1
  if (depth > maxDepth - 1) {
    throw new Error(`Reply exceeds the maximum nesting depth of ${maxDepth} levels.`)
  }
  return depth
}

/** Hook factory: computes and validates depth from the parent comment. */
export function setDepth(commentsSlug: string, maxDepth: number): CollectionBeforeChangeHook {
  return async ({ data, req, operation }) => {
    if (operation !== 'create') return data
    if (!data.parent) {
      data.depth = 0
      return data
    }
    const parent = await req.payload.findByID({
      collection: commentsSlug,
      id: data.parent,
      depth: 0,
    })
    data.depth = resolveDepth(typeof parent.depth === 'number' ? parent.depth : 0, maxDepth)
    return data
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/hooks.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/hooks/setStatusDefault.ts src/hooks/setDepth.ts tests/hooks.test.ts
git commit -m "feat: add status-default and depth hooks"
```

---

## Task 7: Comments collection factory

**Files:**
- Create: `src/collections/Comments.ts`

No standalone unit test here (covered by integration tests in Task 11+). Verify it compiles.

- [ ] **Step 1: Write `src/collections/Comments.ts`**

```ts
import type { CollectionConfig } from 'payload'
import type { ResolvedOptions } from '../types.js'
import { setStatusDefault } from '../hooks/setStatusDefault.js'
import { setDepth } from '../hooks/setDepth.js'

/** Build the comments collection from resolved plugin options. */
export function buildCommentsCollection(options: ResolvedOptions): CollectionConfig {
  return {
    slug: options.commentsSlug,
    labels: { singular: 'Comment', plural: 'Comments' },
    admin: {
      useAsTitle: 'authorName',
      defaultColumns: ['authorName', 'content', 'status', 'createdAt'],
      group: 'Comments',
    },
    access: {
      // Public reads are served through the /tree endpoint with overrideAccess.
      // Direct collection reads: only approved are public; logged-in admins see all.
      read: ({ req: { user } }) => {
        if (user) return true
        return { status: { equals: 'approved' } }
      },
      // Creation is endpoint-only to enforce anti-spam.
      create: ({ req: { user } }) => Boolean(user),
      update: ({ req: { user } }) => Boolean(user),
      delete: ({ req: { user } }) => Boolean(user),
    },
    fields: [
      { name: 'content', type: 'textarea', required: true },
      { name: 'authorName', type: 'text', required: true },
      {
        name: 'authorEmail',
        type: 'email',
        required: options.requireEmail,
        access: {
          // Never expose author email to the public API.
          read: ({ req: { user } }) => Boolean(user),
        },
        admin: { description: 'Stored for moderation; never exposed publicly.' },
      },
      {
        name: 'mood',
        type: 'select',
        options: options.reactions.map((r) => ({ label: `${r.emoji} ${r.label}`, value: r.key })),
        admin: { description: "The author's reaction icon attached to this comment." },
      },
      {
        name: 'status',
        type: 'select',
        defaultValue: options.requireApproval ? 'pending' : 'approved',
        options: [
          { label: 'Pending', value: 'pending' },
          { label: 'Approved', value: 'approved' },
          { label: 'Spam', value: 'spam' },
          { label: 'Trash', value: 'trash' },
        ],
        index: true,
        admin: { position: 'sidebar' },
      },
      {
        name: 'relatedDoc',
        type: 'relationship',
        relationTo: options.enabledCollections,
        required: true,
        index: true,
        admin: { position: 'sidebar' },
      },
      {
        name: 'parent',
        type: 'relationship',
        relationTo: options.commentsSlug,
        admin: { position: 'sidebar', description: 'Parent comment, if this is a reply.' },
      },
      {
        name: 'depth',
        type: 'number',
        defaultValue: 0,
        admin: { readOnly: true, position: 'sidebar' },
      },
      {
        name: 'reactionCounts',
        type: 'json',
        defaultValue: {},
        admin: { readOnly: true, description: 'Denormalized counts per reaction key.' },
      },
      { name: 'ipHash', type: 'text', admin: { readOnly: true, hidden: true } },
      { name: 'fingerprintHash', type: 'text', admin: { readOnly: true, hidden: true } },
    ],
    hooks: {
      beforeChange: [
        setStatusDefault(options.requireApproval),
        setDepth(options.commentsSlug, options.maxDepth),
      ],
    },
  }
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc -p tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/collections/Comments.ts
git commit -m "feat: add comments collection factory"
```

---

## Task 8: Comment-reactions collection factory

**Files:**
- Create: `src/collections/CommentReactions.ts`

- [ ] **Step 1: Write `src/collections/CommentReactions.ts`**

```ts
import type { CollectionConfig } from 'payload'
import type { ResolvedOptions } from '../types.js'

/** Build the reactions collection (source of truth for reactions on comments). */
export function buildCommentReactionsCollection(options: ResolvedOptions): CollectionConfig {
  return {
    slug: options.reactionsSlug,
    labels: { singular: 'Comment Reaction', plural: 'Comment Reactions' },
    admin: {
      useAsTitle: 'emoji',
      defaultColumns: ['comment', 'emoji', 'createdAt'],
      group: 'Comments',
      // Reactions are operational data; keep them out of the main nav clutter.
      hidden: false,
    },
    access: {
      read: ({ req: { user } }) => Boolean(user),
      create: ({ req: { user } }) => Boolean(user),
      update: ({ req: { user } }) => Boolean(user),
      delete: ({ req: { user } }) => Boolean(user),
    },
    fields: [
      {
        name: 'comment',
        type: 'relationship',
        relationTo: options.commentsSlug,
        required: true,
        index: true,
      },
      { name: 'emoji', type: 'text', required: true },
      { name: 'ipHash', type: 'text', index: true },
      { name: 'fingerprintHash', type: 'text', index: true },
    ],
  }
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc -p tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/collections/CommentReactions.ts
git commit -m "feat: add comment-reactions collection factory"
```

---

## Task 9: Plugin entry + dev app (integration harness)

**Files:**
- Create: `src/index.ts`
- Create: `dev/collections/Users.ts`
- Create: `dev/collections/Posts.ts`
- Create: `dev/payload.config.ts`
- Create: `tests/helpers/payload.ts`
- Create: `vitest.config.ts`

- [ ] **Step 1: Write `src/index.ts`**

```ts
import type { Config } from 'payload'
import type { CommentsPluginOptions } from './types.js'
import { resolveOptions } from './defaults.js'
import { buildCommentsCollection } from './collections/Comments.js'
import { buildCommentReactionsCollection } from './collections/CommentReactions.js'
import { treeEndpoint } from './endpoints/treeEndpoint.js'
import { submitEndpoint } from './endpoints/submitEndpoint.js'
import { reactEndpoint } from './endpoints/reactEndpoint.js'

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

    // When disabled, still register collections (stable DB schema) but skip endpoints.
    if (options.disabled) return config

    config.endpoints = [
      ...(config.endpoints ?? []),
      treeEndpoint(options),
      submitEndpoint(options),
      reactEndpoint(options),
    ]

    return config
  }

export default commentsPlugin
```

Note: endpoints are created in Tasks 13–15. To keep this task compiling, create thin placeholder endpoint files now and flesh them out later — OR implement endpoints first. **Order chosen:** create real endpoint files in the next tasks; this file references them, so complete Tasks 13–15 before running the full build. For now, create the three endpoint stub files so imports resolve:

- [ ] **Step 2: Create temporary endpoint stubs** (replaced fully in Tasks 13–15)

```ts
// src/endpoints/treeEndpoint.ts
import type { Endpoint } from 'payload'
import type { ResolvedOptions } from '../types.js'
export function treeEndpoint(_options: ResolvedOptions): Endpoint {
  return { path: '/comments/tree', method: 'get', handler: () => Response.json({ comments: [] }) }
}
```

```ts
// src/endpoints/submitEndpoint.ts
import type { Endpoint } from 'payload'
import type { ResolvedOptions } from '../types.js'
export function submitEndpoint(_options: ResolvedOptions): Endpoint {
  return { path: '/comments/submit', method: 'post', handler: () => Response.json({ ok: true }) }
}
```

```ts
// src/endpoints/reactEndpoint.ts
import type { Endpoint } from 'payload'
import type { ResolvedOptions } from '../types.js'
export function reactEndpoint(_options: ResolvedOptions): Endpoint {
  return { path: '/comments/:id/react', method: 'post', handler: () => Response.json({ ok: true }) }
}
```

- [ ] **Step 3: Create `dev/collections/Users.ts`**

```ts
import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: { useAsTitle: 'email' },
  fields: [],
}
```

- [ ] **Step 4: Create `dev/collections/Posts.ts`**

```ts
import type { CollectionConfig } from 'payload'

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: { useAsTitle: 'title' },
  fields: [{ name: 'title', type: 'text', required: true }],
}
```

- [ ] **Step 5: Create `dev/payload.config.ts`**

```ts
import { buildConfig } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import path from 'path'
import { fileURLToPath } from 'url'
import { Users } from './collections/Users.js'
import { Posts } from './collections/Posts.js'
import { commentsPlugin } from '../src/index.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfig({
  secret: 'test-secret',
  admin: { user: 'users' },
  collections: [Users, Posts],
  db: sqliteAdapter({
    client: { url: process.env.DATABASE_URI || `file:${path.resolve(dirname, 'test.db')}` },
  }),
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  plugins: [
    commentsPlugin({
      enabledCollections: ['posts'],
      requireApproval: true,
    }),
  ],
})
```

- [ ] **Step 6: Create `tests/helpers/payload.ts`**

```ts
import { getPayload, type Payload } from 'payload'
import config from '../../dev/payload.config.js'

let instance: Payload | null = null

/** Get a shared Payload instance for tests (in-memory sqlite). */
export async function getTestPayload(): Promise<Payload> {
  if (instance) return instance
  process.env.DATABASE_URI = ':memory:'
  instance = await getPayload({ config })
  return instance
}

/** Remove all comments and reactions between tests. */
export async function clearComments(payload: Payload): Promise<void> {
  await payload.delete({ collection: 'comment-reactions', where: {} })
  await payload.delete({ collection: 'comments', where: {} })
}

/** Create a post and return its id. */
export async function createPost(payload: Payload, title = 'Test Post'): Promise<string> {
  const post = await payload.create({ collection: 'posts', data: { title } })
  return String(post.id)
}
```

- [ ] **Step 7: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
})
```

- [ ] **Step 8: Verify build + existing tests still pass**

Run: `pnpm tsc -p tsconfig.json --noEmit && pnpm vitest run tests/utils.hash.test.ts tests/utils.rateLimit.test.ts tests/utils.validateContent.test.ts tests/hooks.test.ts`
Expected: type-check passes; all 4 unit test files PASS.

- [ ] **Step 9: Commit**

```bash
git add src/index.ts src/endpoints dev tests/helpers vitest.config.ts
git commit -m "feat: add plugin entry, dev app and test harness"
```

---

## Task 10: getClientIdentity utility (TDD)

**Files:**
- Create: `src/utils/getClientIdentity.ts`
- Test: `tests/utils.getClientIdentity.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/utils.getClientIdentity.test.ts
import { describe, it, expect } from 'vitest'
import { getClientIdentity } from '../src/utils/getClientIdentity.js'

function reqWith(headers: Record<string, string>, fingerprint?: string) {
  return {
    headers: new Headers(headers),
    body: fingerprint ? { fingerprint } : {},
  }
}

describe('getClientIdentity', () => {
  it('reads ip from x-forwarded-for (first entry) and hashes it', () => {
    const id = getClientIdentity(reqWith({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1' }), 'salt')
    expect(id.ipHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('hashes the fingerprint from the body', () => {
    const id = getClientIdentity(reqWith({}, 'fp-123'), 'salt')
    expect(id.fingerprintHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('returns empty hashes when nothing is available', () => {
    const id = getClientIdentity(reqWith({}), 'salt')
    expect(id.ipHash).toBe('')
    expect(id.fingerprintHash).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/utils.getClientIdentity.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/utils/getClientIdentity.ts
import { hashWithSalt } from './hash.js'

interface IdentitySource {
  headers: Headers
  body?: { fingerprint?: string } | unknown
}

export interface ClientIdentity {
  ipHash: string
  fingerprintHash: string
}

/** Extract and hash the client IP (from proxy headers) and the optional fingerprint from the body. */
export function getClientIdentity(req: IdentitySource, salt: string): ClientIdentity {
  const forwarded = req.headers.get('x-forwarded-for') ?? ''
  const realIp = req.headers.get('x-real-ip') ?? ''
  const ip = (forwarded.split(',')[0]?.trim() || realIp || '').trim()
  const body = (req.body ?? {}) as { fingerprint?: string }
  const fingerprint = typeof body.fingerprint === 'string' ? body.fingerprint : ''
  return {
    ipHash: hashWithSalt(ip, salt),
    fingerprintHash: hashWithSalt(fingerprint, salt),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/utils.getClientIdentity.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/getClientIdentity.ts tests/utils.getClientIdentity.test.ts
git commit -m "feat: add client identity extraction"
```

---

## Task 11: submitComment service (TDD, integration)

**Files:**
- Create: `src/services/submitComment.ts`
- Test: `tests/services.submitComment.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/services.submitComment.test.ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import type { Payload } from 'payload'
import { getTestPayload, clearComments, createPost } from './helpers/payload.js'
import { submitComment } from '../src/services/submitComment.js'
import { resolveOptions } from '../src/defaults.js'

let payload: Payload
const options = resolveOptions({ enabledCollections: ['posts'], requireApproval: true })

beforeAll(async () => {
  payload = await getTestPayload()
})
beforeEach(async () => {
  await clearComments(payload)
})

describe('submitComment', () => {
  it('creates a pending top-level comment when approval is required', async () => {
    const postId = await createPost(payload)
    const result = await submitComment(payload, options, {
      content: 'Nice article',
      authorName: 'Alice',
      authorEmail: 'alice@example.com',
      mood: 'like',
      relatedDoc: { relationTo: 'posts', value: postId },
      parent: null,
      ipHash: 'iphash',
      fingerprintHash: 'fphash',
    })
    expect(result.status).toBe('pending')
    expect(result.depth).toBe(0)
    expect(result.content).toBe('Nice article')
  })

  it('creates an approved comment when approval not required', async () => {
    const noApproval = resolveOptions({ enabledCollections: ['posts'], requireApproval: false })
    const postId = await createPost(payload)
    const result = await submitComment(payload, noApproval, {
      content: 'Instant',
      authorName: 'Bob',
      mood: null,
      relatedDoc: { relationTo: 'posts', value: postId },
      parent: null,
      ipHash: '',
      fingerprintHash: '',
    })
    expect(result.status).toBe('approved')
  })

  it('sets depth to 1 for a reply', async () => {
    const postId = await createPost(payload)
    const parent = await submitComment(payload, options, {
      content: 'Parent',
      authorName: 'A',
      mood: null,
      relatedDoc: { relationTo: 'posts', value: postId },
      parent: null,
      ipHash: '',
      fingerprintHash: '',
    })
    const reply = await submitComment(payload, options, {
      content: 'Child',
      authorName: 'B',
      mood: null,
      relatedDoc: { relationTo: 'posts', value: postId },
      parent: String(parent.id),
      ipHash: '',
      fingerprintHash: '',
    })
    expect(reply.depth).toBe(1)
  })

  it('rejects a reply deeper than maxDepth', async () => {
    const postId = await createPost(payload)
    let parentId: string | null = null
    // build depths 0,1,2 (3 levels)
    for (let i = 0; i < 3; i++) {
      const c = await submitComment(payload, options, {
        content: `level ${i}`,
        authorName: 'X',
        mood: null,
        relatedDoc: { relationTo: 'posts', value: postId },
        parent: parentId,
        ipHash: '',
        fingerprintHash: '',
      })
      parentId = String(c.id)
    }
    // a 4th level must fail
    await expect(
      submitComment(payload, options, {
        content: 'too deep',
        authorName: 'X',
        mood: null,
        relatedDoc: { relationTo: 'posts', value: postId },
        parent: parentId,
        ipHash: '',
        fingerprintHash: '',
      }),
    ).rejects.toThrow(/maximum nesting depth/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/services.submitComment.test.ts`
Expected: FAIL — module `../src/services/submitComment.js` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/services/submitComment.ts
import type { Payload } from 'payload'
import type { ResolvedOptions } from '../types.js'

export interface SubmitCommentInput {
  content: string
  authorName: string
  authorEmail?: string
  mood: string | null
  relatedDoc: { relationTo: string; value: string }
  parent: string | null
  ipHash: string
  fingerprintHash: string
}

/**
 * Create a comment via the Local API.
 * Status default and depth validation are enforced by collection hooks,
 * so an over-deep reply throws here (surfaced from the hook).
 */
export async function submitComment(payload: Payload, options: ResolvedOptions, input: SubmitCommentInput) {
  return payload.create({
    collection: options.commentsSlug,
    data: {
      content: input.content,
      authorName: input.authorName,
      authorEmail: input.authorEmail,
      mood: input.mood ?? undefined,
      relatedDoc: input.relatedDoc,
      parent: input.parent ?? undefined,
      ipHash: input.ipHash,
      fingerprintHash: input.fingerprintHash,
      reactionCounts: {},
    },
    overrideAccess: true,
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/services.submitComment.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/submitComment.ts tests/services.submitComment.test.ts
git commit -m "feat: add submitComment service"
```

---

## Task 12: getCommentTree service (TDD, integration)

**Files:**
- Create: `src/services/getCommentTree.ts`
- Test: `tests/services.getCommentTree.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/services.getCommentTree.test.ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import type { Payload } from 'payload'
import { getTestPayload, clearComments, createPost } from './helpers/payload.js'
import { submitComment } from '../src/services/submitComment.js'
import { getCommentTree } from '../src/services/getCommentTree.js'
import { resolveOptions } from '../src/defaults.js'

let payload: Payload
const options = resolveOptions({ enabledCollections: ['posts'], requireApproval: false })

beforeAll(async () => {
  payload = await getTestPayload()
})
beforeEach(async () => {
  await clearComments(payload)
})

async function add(postId: string, content: string, parent: string | null = null) {
  return submitComment(payload, options, {
    content,
    authorName: 'A',
    authorEmail: 'secret@example.com',
    mood: null,
    relatedDoc: { relationTo: 'posts', value: postId },
    parent,
    ipHash: 'ip',
    fingerprintHash: 'fp',
  })
}

describe('getCommentTree', () => {
  it('returns approved comments nested by parent', async () => {
    const postId = await createPost(payload)
    const root = await add(postId, 'root')
    await add(postId, 'child', String(root.id))

    const tree = await getCommentTree(payload, options, { relationTo: 'posts', docId: postId })
    expect(tree).toHaveLength(1)
    expect(tree[0].content).toBe('root')
    expect(tree[0].replies).toHaveLength(1)
    expect(tree[0].replies[0].content).toBe('child')
  })

  it('excludes authorEmail, ipHash and fingerprintHash from output', async () => {
    const postId = await createPost(payload)
    await add(postId, 'root')
    const tree = await getCommentTree(payload, options, { relationTo: 'posts', docId: postId })
    expect(tree[0]).not.toHaveProperty('authorEmail')
    expect(tree[0]).not.toHaveProperty('ipHash')
    expect(tree[0]).not.toHaveProperty('fingerprintHash')
  })

  it('excludes non-approved comments', async () => {
    const approvalOpts = resolveOptions({ enabledCollections: ['posts'], requireApproval: true })
    const postId = await createPost(payload)
    await submitComment(payload, approvalOpts, {
      content: 'pending one',
      authorName: 'A',
      mood: null,
      relatedDoc: { relationTo: 'posts', value: postId },
      parent: null,
      ipHash: '',
      fingerprintHash: '',
    })
    const tree = await getCommentTree(payload, options, { relationTo: 'posts', docId: postId })
    expect(tree).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/services.getCommentTree.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/services/getCommentTree.ts
import type { Payload } from 'payload'
import type { ResolvedOptions } from '../types.js'

export interface PublicComment {
  id: string
  content: string
  authorName: string
  mood: string | null
  depth: number
  reactionCounts: Record<string, number>
  createdAt: string
  replies: PublicComment[]
}

export interface TreeQuery {
  relationTo: string
  docId: string
}

/** Fetch approved comments for a document and assemble them into a nested tree (public-safe fields only). */
export async function getCommentTree(
  payload: Payload,
  options: ResolvedOptions,
  query: TreeQuery,
): Promise<PublicComment[]> {
  const { docs } = await payload.find({
    collection: options.commentsSlug,
    where: {
      and: [
        { status: { equals: 'approved' } },
        { 'relatedDoc.relationTo': { equals: query.relationTo } },
        { 'relatedDoc.value': { equals: query.docId } },
      ],
    },
    sort: 'createdAt',
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })

  const nodes = new Map<string, PublicComment>()
  const roots: PublicComment[] = []

  for (const doc of docs) {
    nodes.set(String(doc.id), {
      id: String(doc.id),
      content: doc.content,
      authorName: doc.authorName,
      mood: doc.mood ?? null,
      depth: typeof doc.depth === 'number' ? doc.depth : 0,
      reactionCounts: (doc.reactionCounts as Record<string, number>) ?? {},
      createdAt: doc.createdAt,
      replies: [],
    })
  }

  for (const doc of docs) {
    const node = nodes.get(String(doc.id))!
    const parentId = doc.parent ? String(doc.parent) : null
    if (parentId && nodes.has(parentId)) {
      nodes.get(parentId)!.replies.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/services.getCommentTree.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/getCommentTree.ts tests/services.getCommentTree.test.ts
git commit -m "feat: add getCommentTree service"
```

---

## Task 13: reactToComment service (TDD, integration)

**Files:**
- Create: `src/services/reactToComment.ts`
- Test: `tests/services.reactToComment.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/services.reactToComment.test.ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import type { Payload } from 'payload'
import { getTestPayload, clearComments, createPost } from './helpers/payload.js'
import { submitComment } from '../src/services/submitComment.js'
import { reactToComment } from '../src/services/reactToComment.js'
import { resolveOptions } from '../src/defaults.js'

let payload: Payload
const options = resolveOptions({ enabledCollections: ['posts'], requireApproval: false })

beforeAll(async () => {
  payload = await getTestPayload()
})
beforeEach(async () => {
  await clearComments(payload)
})

async function makeComment(postId: string) {
  return submitComment(payload, options, {
    content: 'react to me',
    authorName: 'A',
    mood: null,
    relatedDoc: { relationTo: 'posts', value: postId },
    parent: null,
    ipHash: '',
    fingerprintHash: '',
  })
}

describe('reactToComment', () => {
  it('adds a reaction and increments the count', async () => {
    const postId = await createPost(payload)
    const c = await makeComment(postId)
    const res = await reactToComment(payload, options, {
      commentId: String(c.id),
      emoji: 'like',
      ipHash: 'ip1',
      fingerprintHash: 'fp1',
    })
    expect(res.reactionCounts.like).toBe(1)
    expect(res.toggled).toBe('added')
  })

  it('removes the reaction when the same identity reacts again (toggle)', async () => {
    const postId = await createPost(payload)
    const c = await makeComment(postId)
    const identity = { commentId: String(c.id), emoji: 'like', ipHash: 'ip1', fingerprintHash: 'fp1' }
    await reactToComment(payload, options, identity)
    const res = await reactToComment(payload, options, identity)
    expect(res.reactionCounts.like ?? 0).toBe(0)
    expect(res.toggled).toBe('removed')
  })

  it('counts distinct identities separately', async () => {
    const postId = await createPost(payload)
    const c = await makeComment(postId)
    await reactToComment(payload, options, { commentId: String(c.id), emoji: 'like', ipHash: 'ip1', fingerprintHash: 'fp1' })
    const res = await reactToComment(payload, options, { commentId: String(c.id), emoji: 'like', ipHash: 'ip2', fingerprintHash: 'fp2' })
    expect(res.reactionCounts.like).toBe(2)
  })

  it('rejects an emoji not in the configured set', async () => {
    const postId = await createPost(payload)
    const c = await makeComment(postId)
    await expect(
      reactToComment(payload, options, { commentId: String(c.id), emoji: 'rocket', ipHash: 'ip', fingerprintHash: 'fp' }),
    ).rejects.toThrow(/unknown reaction/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/services.reactToComment.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/services/reactToComment.ts
import type { Payload } from 'payload'
import type { ResolvedOptions } from '../types.js'

export interface ReactInput {
  commentId: string
  emoji: string
  ipHash: string
  fingerprintHash: string
}

export interface ReactResult {
  reactionCounts: Record<string, number>
  toggled: 'added' | 'removed'
}

/**
 * Toggle a reaction for one identity on a comment, then recompute the
 * denormalized counts from the reactions collection (source of truth).
 */
export async function reactToComment(
  payload: Payload,
  options: ResolvedOptions,
  input: ReactInput,
): Promise<ReactResult> {
  const known = options.reactions.some((r) => r.key === input.emoji)
  if (!known) throw new Error(`Unknown reaction: ${input.emoji}`)

  const existing = await payload.find({
    collection: options.reactionsSlug,
    where: {
      and: [
        { comment: { equals: input.commentId } },
        { emoji: { equals: input.emoji } },
        { ipHash: { equals: input.ipHash } },
        { fingerprintHash: { equals: input.fingerprintHash } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  })

  let toggled: 'added' | 'removed'
  if (existing.docs.length > 0) {
    await payload.delete({ collection: options.reactionsSlug, id: existing.docs[0].id, overrideAccess: true })
    toggled = 'removed'
  } else {
    await payload.create({
      collection: options.reactionsSlug,
      data: {
        comment: input.commentId,
        emoji: input.emoji,
        ipHash: input.ipHash,
        fingerprintHash: input.fingerprintHash,
      },
      overrideAccess: true,
    })
    toggled = 'added'
  }

  const counts = await recomputeCounts(payload, options, input.commentId)
  await payload.update({
    collection: options.commentsSlug,
    id: input.commentId,
    data: { reactionCounts: counts },
    overrideAccess: true,
  })

  return { reactionCounts: counts, toggled }
}

async function recomputeCounts(
  payload: Payload,
  options: ResolvedOptions,
  commentId: string,
): Promise<Record<string, number>> {
  const { docs } = await payload.find({
    collection: options.reactionsSlug,
    where: { comment: { equals: commentId } },
    limit: 0,
    overrideAccess: true,
  })
  const counts: Record<string, number> = {}
  for (const r of docs) {
    counts[r.emoji] = (counts[r.emoji] ?? 0) + 1
  }
  return counts
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/services.reactToComment.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/reactToComment.ts tests/services.reactToComment.test.ts
git commit -m "feat: add reactToComment service with toggle and recount"
```

---

## Task 14: Wire real endpoints

Replace the stubs from Task 9 with real handlers that parse the request, compute identity, rate-limit, and delegate to services.

**Files:**
- Modify: `src/endpoints/treeEndpoint.ts`
- Modify: `src/endpoints/submitEndpoint.ts`
- Modify: `src/endpoints/reactEndpoint.ts`

- [ ] **Step 1: Implement `src/endpoints/treeEndpoint.ts`**

```ts
import type { Endpoint, PayloadRequest } from 'payload'
import type { ResolvedOptions } from '../types.js'
import { getCommentTree } from '../services/getCommentTree.js'

export function treeEndpoint(options: ResolvedOptions): Endpoint {
  return {
    path: '/comments/tree',
    method: 'get',
    handler: async (req: PayloadRequest) => {
      const relationTo = req.searchParams.get('relationTo') ?? ''
      const docId = req.searchParams.get('docId') ?? ''
      if (!relationTo || !docId) {
        return Response.json({ error: 'relationTo and docId are required' }, { status: 400 })
      }
      if (!options.enabledCollections.includes(relationTo as never)) {
        return Response.json({ error: 'Collection not enabled for comments' }, { status: 400 })
      }
      const comments = await getCommentTree(req.payload, options, { relationTo, docId })
      return Response.json({ comments })
    },
  }
}
```

- [ ] **Step 2: Implement `src/endpoints/submitEndpoint.ts`**

```ts
import type { Endpoint, PayloadRequest } from 'payload'
import { addDataAndFileToRequest } from 'payload'
import type { ResolvedOptions } from '../types.js'
import { submitComment } from '../services/submitComment.js'
import { validateSubmission } from '../utils/validateContent.js'
import { getClientIdentity } from '../utils/getClientIdentity.js'
import { createRateLimiter } from '../utils/rateLimit.js'

export function submitEndpoint(options: ResolvedOptions): Endpoint {
  // One limiter instance per plugin registration (per server process).
  const limiter = createRateLimiter(options.rateLimit)

  return {
    path: '/comments/submit',
    method: 'post',
    handler: async (req: PayloadRequest) => {
      await addDataAndFileToRequest(req)
      const data = (req.data ?? {}) as Record<string, unknown>

      const identity = getClientIdentity({ headers: req.headers, body: data }, options.ipSalt)

      if (identity.ipHash && !limiter.check(identity.ipHash)) {
        return Response.json({ error: 'Too many comments, please slow down.' }, { status: 429 })
      }

      const validation = validateSubmission(
        { content: String(data.content ?? ''), honeypot: String(data.honeypot ?? '') },
        { minLength: options.minLength, maxLength: options.maxLength, blockLinks: options.blockLinks },
      )
      if (!validation.ok) {
        const status = validation.reason === 'spam' ? 202 : 400
        // For honeypot spam, respond 202 so bots get no useful signal.
        return Response.json({ ok: validation.reason === 'spam', reason: validation.reason }, { status })
      }

      if (options.requireEmail && !data.authorEmail) {
        return Response.json({ error: 'Email is required.' }, { status: 400 })
      }

      const relatedDoc = data.relatedDoc as { relationTo?: string; value?: string } | undefined
      if (!relatedDoc?.relationTo || !relatedDoc?.value) {
        return Response.json({ error: 'relatedDoc is required.' }, { status: 400 })
      }
      if (!options.enabledCollections.includes(relatedDoc.relationTo as never)) {
        return Response.json({ error: 'Collection not enabled for comments.' }, { status: 400 })
      }

      try {
        const created = await submitComment(req.payload, options, {
          content: String(data.content),
          authorName: String(data.authorName ?? 'Anonymous'),
          authorEmail: data.authorEmail ? String(data.authorEmail) : undefined,
          mood: data.mood ? String(data.mood) : null,
          relatedDoc: { relationTo: relatedDoc.relationTo, value: relatedDoc.value },
          parent: data.parent ? String(data.parent) : null,
          ipHash: identity.ipHash,
          fingerprintHash: identity.fingerprintHash,
        })
        return Response.json({
          ok: true,
          status: created.status,
          pending: created.status === 'pending',
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not submit comment.'
        return Response.json({ error: message }, { status: 400 })
      }
    },
  }
}
```

- [ ] **Step 3: Implement `src/endpoints/reactEndpoint.ts`**

```ts
import type { Endpoint, PayloadRequest } from 'payload'
import { addDataAndFileToRequest } from 'payload'
import type { ResolvedOptions } from '../types.js'
import { reactToComment } from '../services/reactToComment.js'
import { getClientIdentity } from '../utils/getClientIdentity.js'

export function reactEndpoint(options: ResolvedOptions): Endpoint {
  return {
    path: '/comments/:id/react',
    method: 'post',
    handler: async (req: PayloadRequest) => {
      await addDataAndFileToRequest(req)
      const data = (req.data ?? {}) as Record<string, unknown>
      const commentId = req.routeParams?.id ? String(req.routeParams.id) : ''
      const emoji = String(data.emoji ?? '')
      if (!commentId || !emoji) {
        return Response.json({ error: 'comment id and emoji are required' }, { status: 400 })
      }
      const identity = getClientIdentity({ headers: req.headers, body: data }, options.ipSalt)
      try {
        const result = await reactToComment(req.payload, options, {
          commentId,
          emoji,
          ipHash: identity.ipHash,
          fingerprintHash: identity.fingerprintHash,
        })
        return Response.json(result)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not react.'
        return Response.json({ error: message }, { status: 400 })
      }
    },
  }
}
```

- [ ] **Step 4: Type-check the full build**

Run: `pnpm tsc -p tsconfig.json --noEmit`
Expected: no errors. If `req.searchParams` / `req.routeParams` types differ in the installed Payload version, adjust to the documented accessor (check `node_modules/payload/dist/types` for `PayloadRequest`).

- [ ] **Step 5: Run the entire test suite**

Run: `pnpm vitest run`
Expected: all test files PASS.

- [ ] **Step 6: Commit**

```bash
git add src/endpoints
git commit -m "feat: implement tree, submit and react endpoints"
```

---

## Task 15: Public access integration test

Confirms that an unauthenticated Local API read only returns approved comments and that email is protected. This guards the access rules in the collection.

**Files:**
- Test: `tests/collection.access.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/collection.access.test.ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import type { Payload } from 'payload'
import { getTestPayload, clearComments, createPost } from './helpers/payload.js'
import { submitComment } from '../src/services/submitComment.js'
import { resolveOptions } from '../src/defaults.js'

let payload: Payload
const approval = resolveOptions({ enabledCollections: ['posts'], requireApproval: true })

beforeAll(async () => {
  payload = await getTestPayload()
})
beforeEach(async () => {
  await clearComments(payload)
})

describe('public collection access', () => {
  it('hides non-approved comments from unauthenticated reads', async () => {
    const postId = await createPost(payload)
    await submitComment(payload, approval, {
      content: 'pending',
      authorName: 'A',
      mood: null,
      relatedDoc: { relationTo: 'posts', value: postId },
      parent: null,
      ipHash: '',
      fingerprintHash: '',
    })
    // overrideAccess:false simulates an anonymous request
    const result = await payload.find({
      collection: 'comments',
      overrideAccess: false,
      where: { 'relatedDoc.value': { equals: postId } },
    })
    expect(result.docs).toHaveLength(0)
  })

  it('shows approved comments to unauthenticated reads', async () => {
    const noApproval = resolveOptions({ enabledCollections: ['posts'], requireApproval: false })
    const postId = await createPost(payload)
    await submitComment(payload, noApproval, {
      content: 'approved',
      authorName: 'A',
      mood: null,
      relatedDoc: { relationTo: 'posts', value: postId },
      parent: null,
      ipHash: '',
      fingerprintHash: '',
    })
    const result = await payload.find({
      collection: 'comments',
      overrideAccess: false,
      where: { 'relatedDoc.value': { equals: postId } },
    })
    expect(result.docs).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm vitest run tests/collection.access.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 3: Commit**

```bash
git add tests/collection.access.test.ts
git commit -m "test: verify public access only exposes approved comments"
```

---

## Task 16: React component `<Comments />` and client exports

**Files:**
- Create: `src/components/Comments.tsx`
- Create: `src/components/Comments.module.css`
- Create: `src/exports/client.ts`
- Create: `src/exports/types.ts`

No automated test (visual/runtime component); verify it type-checks and builds. The frontend integration doc (Task 17) documents usage.

- [ ] **Step 1: Create `src/components/Comments.module.css`**

```css
.wrapper {
  --pc-gap: 12px;
  --pc-border: #e1e1e4;
  --pc-bg: #ffffff;
  --pc-fg: #1f1f23;
  --pc-muted: #6b7280;
  --pc-accent: #2563eb;
  font-family: inherit;
  color: var(--pc-fg);
  display: flex;
  flex-direction: column;
  gap: var(--pc-gap);
}
.comment {
  border: 1px solid var(--pc-border);
  border-radius: 8px;
  padding: 12px;
  background: var(--pc-bg);
}
.replies {
  margin-top: var(--pc-gap);
  margin-left: 20px;
  display: flex;
  flex-direction: column;
  gap: var(--pc-gap);
}
.meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: var(--pc-muted);
  margin-bottom: 6px;
}
.author {
  font-weight: 600;
  color: var(--pc-fg);
}
.reactions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.reactionButton {
  border: 1px solid var(--pc-border);
  background: transparent;
  border-radius: 999px;
  padding: 2px 10px;
  cursor: pointer;
  font-size: 0.9rem;
}
.reactionButton:hover {
  border-color: var(--pc-accent);
}
.form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid var(--pc-border);
  border-radius: 8px;
  padding: 12px;
}
.row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.input,
.textarea {
  border: 1px solid var(--pc-border);
  border-radius: 6px;
  padding: 8px;
  font: inherit;
  width: 100%;
  box-sizing: border-box;
}
.honeypot {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}
.moodPicker {
  display: flex;
  gap: 6px;
}
.moodOption {
  border: 1px solid var(--pc-border);
  background: transparent;
  border-radius: 6px;
  padding: 4px 8px;
  cursor: pointer;
}
.moodOptionActive {
  border-color: var(--pc-accent);
  background: rgba(37, 99, 235, 0.08);
}
.submit {
  align-self: flex-start;
  background: var(--pc-accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  cursor: pointer;
  font: inherit;
}
.submit:disabled {
  opacity: 0.6;
  cursor: default;
}
.notice {
  font-size: 0.85rem;
  color: var(--pc-muted);
}
```

- [ ] **Step 2: Create `src/components/Comments.tsx`**

```tsx
'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import styles from './Comments.module.css'
import { DEFAULT_REACTIONS } from '../defaults.js'
import type { Reaction } from '../types.js'

interface PublicComment {
  id: string
  content: string
  authorName: string
  mood: string | null
  depth: number
  reactionCounts: Record<string, number>
  createdAt: string
  replies: PublicComment[]
}

export interface CommentsProps {
  /** Base URL of the Payload server, e.g. "https://cms.example.com". Defaults to same origin. */
  serverURL?: string
  /** Slug of the collection the document belongs to, e.g. "posts". */
  relationTo: string
  /** ID of the document being commented on. */
  docId: string
  /** Reaction set; must match the server configuration. Defaults to the built-in set. */
  reactions?: Reaction[]
  /** Whether to require an email in the form. Should mirror server `requireEmail`. */
  requireEmail?: boolean
  /** Max nesting depth to allow replying at. Defaults to 3. */
  maxDepth?: number
}

const apiBase = (serverURL?: string) => `${serverURL ?? ''}/api`

function browserFingerprint(): string {
  if (typeof navigator === 'undefined') return ''
  return [navigator.userAgent, navigator.language, screen?.width, screen?.height].join('|')
}

export function Comments({
  serverURL,
  relationTo,
  docId,
  reactions = DEFAULT_REACTIONS,
  requireEmail = false,
  maxDepth = 3,
}: CommentsProps) {
  const [comments, setComments] = useState<PublicComment[]>([])
  const [loading, setLoading] = useState(true)
  const fingerprint = useMemo(browserFingerprint, [])

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(
      `${apiBase(serverURL)}/comments/tree?relationTo=${encodeURIComponent(relationTo)}&docId=${encodeURIComponent(docId)}`,
    )
    const json = await res.json()
    setComments(json.comments ?? [])
    setLoading(false)
  }, [serverURL, relationTo, docId])

  useEffect(() => {
    void load()
  }, [load])

  const react = useCallback(
    async (commentId: string, emoji: string) => {
      await fetch(`${apiBase(serverURL)}/comments/${commentId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji, fingerprint }),
      })
      await load()
    },
    [serverURL, fingerprint, load],
  )

  if (loading) return <div className={styles.wrapper}>Loading comments…</div>

  return (
    <div className={styles.wrapper}>
      {comments.map((c) => (
        <CommentNode
          key={c.id}
          comment={c}
          reactions={reactions}
          onReact={react}
          serverURL={serverURL}
          relationTo={relationTo}
          docId={docId}
          requireEmail={requireEmail}
          maxDepth={maxDepth}
          onPosted={load}
          fingerprint={fingerprint}
        />
      ))}
      <CommentForm
        serverURL={serverURL}
        relationTo={relationTo}
        docId={docId}
        parent={null}
        reactions={reactions}
        requireEmail={requireEmail}
        onPosted={load}
        fingerprint={fingerprint}
      />
    </div>
  )
}

interface NodeProps {
  comment: PublicComment
  reactions: Reaction[]
  onReact: (commentId: string, emoji: string) => void
  serverURL?: string
  relationTo: string
  docId: string
  requireEmail: boolean
  maxDepth: number
  onPosted: () => void
  fingerprint: string
}

function CommentNode(props: NodeProps) {
  const { comment, reactions, onReact, maxDepth } = props
  const [replying, setReplying] = useState(false)
  const mood = reactions.find((r) => r.key === comment.mood)
  const canReply = comment.depth < maxDepth - 1

  return (
    <div className={styles.comment}>
      <div className={styles.meta}>
        <span className={styles.author}>{comment.authorName}</span>
        {mood && <span title={mood.label}>{mood.emoji}</span>}
        <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
      </div>
      <div>{comment.content}</div>
      <div className={styles.reactions}>
        {reactions.map((r) => (
          <button
            key={r.key}
            type="button"
            className={styles.reactionButton}
            onClick={() => onReact(comment.id, r.key)}
            aria-label={r.label}
          >
            {r.emoji} {comment.reactionCounts[r.key] ?? 0}
          </button>
        ))}
        {canReply && (
          <button type="button" className={styles.reactionButton} onClick={() => setReplying((v) => !v)}>
            Reply
          </button>
        )}
      </div>
      {replying && (
        <CommentForm
          serverURL={props.serverURL}
          relationTo={props.relationTo}
          docId={props.docId}
          parent={comment.id}
          reactions={reactions}
          requireEmail={props.requireEmail}
          onPosted={() => {
            setReplying(false)
            props.onPosted()
          }}
          fingerprint={props.fingerprint}
        />
      )}
      {comment.replies.length > 0 && (
        <div className={styles.replies}>
          {comment.replies.map((child) => (
            <CommentNode key={child.id} {...props} comment={child} />
          ))}
        </div>
      )}
    </div>
  )
}

interface FormProps {
  serverURL?: string
  relationTo: string
  docId: string
  parent: string | null
  reactions: Reaction[]
  requireEmail: boolean
  onPosted: () => void
  fingerprint: string
}

function CommentForm({
  serverURL,
  relationTo,
  docId,
  parent,
  reactions,
  requireEmail,
  onPosted,
  fingerprint,
}: FormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [content, setContent] = useState('')
  const [mood, setMood] = useState<string | null>(null)
  const [honeypot, setHoneypot] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setNotice(null)
    const res = await fetch(`${apiBase(serverURL)}/comments/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        authorName: name,
        authorEmail: email || undefined,
        mood,
        honeypot,
        fingerprint,
        relatedDoc: { relationTo, value: docId },
        parent,
      }),
    })
    const json = await res.json()
    setSubmitting(false)
    if (!res.ok) {
      setNotice(json.error ?? 'Could not submit your comment.')
      return
    }
    if (json.pending) {
      setNotice('Thanks! Your comment is awaiting moderation.')
    } else {
      setNotice(null)
      onPosted()
    }
    setContent('')
    setMood(null)
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.row}>
        <input
          className={styles.input}
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={{ flex: 1 }}
        />
        <input
          className={styles.input}
          placeholder={requireEmail ? 'Email (required)' : 'Email (optional)'}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required={requireEmail}
          style={{ flex: 1 }}
        />
      </div>
      <textarea
        className={styles.textarea}
        placeholder="Write a comment…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        required
      />
      <div className={styles.moodPicker}>
        {reactions.map((r) => (
          <button
            key={r.key}
            type="button"
            className={`${styles.moodOption} ${mood === r.key ? styles.moodOptionActive : ''}`}
            onClick={() => setMood((m) => (m === r.key ? null : r.key))}
            aria-label={r.label}
          >
            {r.emoji}
          </button>
        ))}
      </div>
      {/* Honeypot field: hidden from humans, bots tend to fill it. */}
      <input
        className={styles.honeypot}
        tabIndex={-1}
        autoComplete="off"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        aria-hidden="true"
      />
      <button className={styles.submit} type="submit" disabled={submitting}>
        {parent ? 'Reply' : 'Post comment'}
      </button>
      {notice && <div className={styles.notice}>{notice}</div>}
    </form>
  )
}

export default Comments
```

- [ ] **Step 3: Create `src/exports/client.ts`**

```ts
export { Comments, default } from '../components/Comments.js'
export type { CommentsProps } from '../components/Comments.js'
```

- [ ] **Step 4: Create `src/exports/types.ts`**

```ts
export type { CommentsPluginOptions, Reaction, CommentStatus } from '../types.js'
export type { PublicComment } from '../services/getCommentTree.js'
```

- [ ] **Step 5: Build the package**

Run: `pnpm build`
Expected: `dist/` produced with `index.js`, `exports/client.js`, `exports/types.js`, `components/Comments.js` and `.d.ts` files. CSS module import must not break the build — if `tsc` errors on the `.css` import, add `src/css.d.ts` with `declare module '*.module.css' { const c: Record<string,string>; export default c }` and re-run.

- [ ] **Step 6: Commit**

```bash
git add src/components src/exports
git commit -m "feat: add Comments React component and client exports"
```

---

## Task 17: Documentation

**Files:**
- Create: `README.md`
- Create: `docs/configuration.md`
- Create: `docs/frontend-integration.md`
- Create: `docs/moderation.md`

- [ ] **Step 1: Create `README.md`**

````markdown
# @navanem/payload-comments

Anonymous comments and reactions for Payload 3.x — with optional pre-publish
moderation, mood emojis, reactions on comments, and up to 3 levels of replies.

## Features

- Anyone can comment (name + optional/required email) with a mood emoji.
- React to existing comments with a configurable emoji set.
- Optional approval workflow before comments are published.
- Up to 3 levels of nested replies.
- Built-in lightweight anti-spam (honeypot, rate limiting, length/link rules).
- Ready-to-use `<Comments />` React component, or build your own on the REST API.

## Install

```bash
pnpm add @navanem/payload-comments
# or from Git until published:
pnpm add github:navanem/navanem_payload_comments
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
````

- [ ] **Step 2: Create `docs/configuration.md`**

````markdown
# Configuration

`commentsPlugin(options)` accepts:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabledCollections` | `string[]` | — (required) | Collections whose documents can be commented on. |
| `requireApproval` | `boolean` | `true` | New comments start as `pending` and stay hidden until approved. |
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

## Privacy

IP addresses and browser fingerprints are never stored in clear text — only
salted SHA-256 hashes, used for reaction de-duplication and rate limiting.
Set a stable, secret `COMMENTS_IP_SALT`.
````

- [ ] **Step 3: Create `docs/frontend-integration.md`**

````markdown
# Front-end integration

## Option A — the bundled component

```tsx
import { Comments } from '@navanem/payload-comments/client'

<Comments
  relationTo="posts"
  docId={post.id}
  serverURL="https://cms.example.com" // omit if same origin
  requireEmail={false}
  maxDepth={3}
/>
```

### Props

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `relationTo` | `string` | — | Target collection slug. |
| `docId` | `string` | — | Target document id. |
| `serverURL` | `string` | same origin | Payload server base URL. |
| `reactions` | `Reaction[]` | built-in set | Must mirror server config. |
| `requireEmail` | `boolean` | `false` | Mirror server `requireEmail`. |
| `maxDepth` | `number` | `3` | Mirror server `maxDepth`. |

### Styling

The component uses CSS Modules with CSS variables. Override them by wrapping:

```css
.my-comments {
  --pc-accent: #db2777;
  --pc-border: #d4d4d8;
}
```

```tsx
<div className="my-comments"><Comments relationTo="posts" docId={id} /></div>
```

## Option B — build your own UI on the REST API

### Get the comment tree

```
GET /api/comments/tree?relationTo=posts&docId=<id>
→ { comments: PublicComment[] }   // approved only, nested, email stripped
```

### Submit a comment

```
POST /api/comments/submit
Content-Type: application/json

{
  "content": "Great post!",
  "authorName": "Alice",
  "authorEmail": "alice@example.com",
  "mood": "like",
  "fingerprint": "<browser fingerprint string>",
  "honeypot": "",
  "relatedDoc": { "relationTo": "posts", "value": "<id>" },
  "parent": null
}
→ { ok: true, status: "pending" | "approved", pending: boolean }
```

Leave `honeypot` empty; it is a bot trap. Send a stable `fingerprint` string
(e.g. derived from user agent + language) to improve reaction de-duplication.

### React to a comment

```
POST /api/comments/<commentId>/react
Content-Type: application/json

{ "emoji": "like", "fingerprint": "<browser fingerprint string>" }
→ { reactionCounts: { like: 3 }, toggled: "added" | "removed" }
```

Reactions toggle: posting the same emoji from the same identity removes it.
````

- [ ] **Step 4: Create `docs/moderation.md`**

````markdown
# Moderation

## Workflow

Each comment has a `status`: `pending`, `approved`, `spam`, or `trash`.

- With `requireApproval: true` (default), new comments are `pending` and hidden
  from the public `tree` endpoint until an admin approves them.
- With `requireApproval: false`, comments are `approved` immediately; admins can
  still move them to `spam` or `trash` afterwards.

## In the admin panel

Open the **Comments** collection. Use the `status` filter to find pending
comments, open one, and change its status in the sidebar. Only `approved`
comments are returned by the public API.

The author's email is stored for moderation but is never exposed by the public
API or to non-authenticated users.

## Reactions

Reactions on comments are never moderated — they apply immediately and are
de-duplicated per visitor (hashed IP + fingerprint). They live in the
**Comment Reactions** collection; `reactionCounts` on each comment is a
denormalized cache derived from it.

## Anti-spam

Built-in protections: honeypot field, per-IP rate limiting, min/max length, and
an optional link blocker (`blockLinks`). These are deterrents, not a guarantee;
for high-traffic sites consider fronting submission with a CAPTCHA or WAF.
````

- [ ] **Step 5: Commit**

```bash
git add README.md docs/configuration.md docs/frontend-integration.md docs/moderation.md
git commit -m "docs: add readme, configuration, frontend and moderation guides"
```

---

## Task 18: Changelog, versioning and final verification

**Files:**
- Create: `CHANGELOG.md`

- [ ] **Step 1: Create `CHANGELOG.md`**

```markdown
# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.0]: https://github.com/navanem/navanem_payload_comments/releases/tag/v0.1.0
```

- [ ] **Step 2: Run the full test suite and build**

Run: `pnpm vitest run && pnpm build`
Expected: all tests PASS; `dist/` builds with no errors.

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: add changelog for 0.1.0"
```

- [ ] **Step 4: Tag the release**

```bash
git tag -a v0.1.0 -m "v0.1.0"
```

- [ ] **Step 5: Push branch and tag** (only when the user asks to push)

```bash
git push -u origin main
git push origin v0.1.0
```

---

## Self-Review (completed during planning)

- **Spec coverage:** Payload 3.x (Task 1, 9), polymorphic relation (Task 7), anonymous name+email with protected email (Task 7, 15), mood emoji A (Task 7, 16), reactions B with dedup (Task 8, 13), requireApproval workflow (Task 6, 7, 11), 3-level depth enforcement (Task 6, 11), anti-spam honeypot/rate-limit/length/links (Task 4, 5, 14), hashed IP/fingerprint (Task 3, 10), `<Comments />` component + raw API (Task 16, 17), admin fidelity via native fields (Task 7, 8), npm-ready package + exports (Task 1), docs (Task 17), SemVer + CHANGELOG + tag (Task 18), no AI-assistant attribution (Conventions). All covered.
- **Placeholder scan:** The only deliberate temporary code is the endpoint stubs in Task 9, fully replaced in Task 14 (called out explicitly). No TBD/TODO remain.
- **Type consistency:** `ResolvedOptions`, `Reaction`, `PublicComment`, `submitComment`/`getCommentTree`/`reactToComment` signatures are consistent across tasks and tests.

## Known version-specific risks (verify against the installed Payload)

- `PayloadRequest` accessors for query/route params (`req.searchParams`, `req.routeParams`) and `addDataAndFileToRequest` are Payload 3 APIs; confirm exact names in the installed minor version and adjust if needed (noted in Task 14).
- Polymorphic relationship querying via `relatedDoc.relationTo` / `relatedDoc.value` — confirm against the SQLite adapter; if needed, store `targetCollection` and `targetId` as plain indexed text fields instead. This fallback does not change any service/endpoint signature.
```
