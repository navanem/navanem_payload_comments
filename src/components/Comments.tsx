'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import styles from './Comments.module.css'
import { DEFAULT_REACTIONS } from '../defaults.js'
import type { Reaction } from '../types.js'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Safe Markdown rendering for user comments. react-markdown v10 renders to React
// elements and ignores raw HTML by default (no XSS); we additionally allow-list
// the element set and harden links (new tab + noopener + nofollow ugc). remark-gfm
// adds autolinks, strikethrough and task lists.
const MD_ALLOWED = ['p', 'br', 'strong', 'em', 'del', 'a', 'code', 'pre', 'ul', 'ol', 'li', 'blockquote']
const MD_COMPONENTS = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  a: ({ node, ...props }: any) => <a {...props} target="_blank" rel="noopener noreferrer nofollow ugc" />,
}

/** Renders a comment body as a safe subset of Markdown. */
function CommentBody({ text }: { text: string }) {
  return (
    <div className={styles.body}>
      <Markdown remarkPlugins={[remarkGfm]} allowedElements={MD_ALLOWED} unwrapDisallowed components={MD_COMPONENTS}>
        {text}
      </Markdown>
    </div>
  )
}

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
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return ''
  return [navigator.userAgent, navigator.language, window.screen?.width, window.screen?.height].join('|')
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
  const [closed, setClosed] = useState(false)
  const fingerprint = useMemo(browserFingerprint, [])

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(
      `${apiBase(serverURL)}/comments-api/tree?relationTo=${encodeURIComponent(relationTo)}&docId=${encodeURIComponent(docId)}`,
    )
    const json = await res.json()
    setComments(json.comments ?? [])
    setClosed(Boolean(json.disabled))
    setLoading(false)
  }, [serverURL, relationTo, docId])

  useEffect(() => {
    void load()
  }, [load])

  const react = useCallback(
    async (commentId: string, emoji: string) => {
      await fetch(`${apiBase(serverURL)}/comments-api/${commentId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji, fingerprint }),
      })
      await load()
    },
    [serverURL, fingerprint, load],
  )

  if (loading) return <div className={styles.wrapper}>Loading comments…</div>

  if (closed)
    return (
      <div className={styles.wrapper}>
        <p style={{ opacity: 0.7, fontSize: 14, margin: 0 }}>Comments are closed for this content.</p>
      </div>
    )

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
      <CommentBody text={comment.content} />
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
    const res = await fetch(`${apiBase(serverURL)}/comments-api/submit`, {
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
      <small className={styles.hint}>Markdown supported — bold, italic, code, links, lists</small>
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
