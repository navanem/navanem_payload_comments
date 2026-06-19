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

### Markdown

Comment bodies are rendered as a safe subset of Markdown (bold, italic,
strikethrough, inline/block code, links, lists, blockquotes) via `react-markdown`
+ `remark-gfm`. Raw HTML is never rendered, so user input cannot inject markup;
links are forced to open in a new tab with `rel="noopener noreferrer nofollow ugc"`.
If you build your own UI on the REST API, the stored `content` is the raw Markdown
string — render it with your own safe Markdown renderer.

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
GET /api/comments-api/tree?relationTo=posts&docId=<id>
→ { comments: PublicComment[] }   // approved only, nested, email stripped
```

### Submit a comment

```
POST /api/comments-api/submit
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
POST /api/comments-api/<commentId>/react
Content-Type: application/json

{ "emoji": "like", "fingerprint": "<browser fingerprint string>" }
→ { reactionCounts: { like: 3 }, toggled: "added" | "removed" }
```

Reactions toggle: posting the same emoji from the same identity removes it.
