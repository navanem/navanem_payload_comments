import { DefaultTemplate } from '@payloadcms/next/templates'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

const COMMENTS_SLUG = 'comments'
const REACTIONS_SLUG = 'comment-reactions'

const STATUSES = ['approved', 'pending', 'spam', 'trash'] as const
type Status = (typeof STATUSES)[number]

const STATUS_COLOR: Record<Status, string> = {
  approved: '#22c55e',
  pending: '#f59e0b',
  spam: '#ef4444',
  trash: '#9ca3af',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>

function sp(searchParams: AdminViewServerProps['searchParams'], key: string): string | null {
  const v = searchParams?.[key]
  if (typeof v === 'string' && v.length > 0) return v
  return null
}

function relTo(doc: Doc): string {
  const r = doc?.relatedDoc
  if (r && typeof r === 'object' && 'relationTo' in r) return String(r.relationTo)
  return 'unknown'
}

function snippet(text: unknown, n = 90): string {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim()
  return s.length > n ? `${s.slice(0, n)}…` : s
}

export async function CommentsStatsView({
  initPageResult,
  params,
  searchParams,
}: AdminViewServerProps) {
  const { req, visibleEntities } = initPageResult
  const { payload } = req

  // Auth gate: this view runs server-side and queries moderation data (including
  // unapproved comments). Payload only gates the admin on the client, so without
  // this guard the SSR'd data would leak into public page source. Render nothing
  // for unauthenticated requests.
  if (!req.user) return null

  // ── Filters (collection + period drive the scope; status filters the table) ──
  const collFilter = sp(searchParams, 'collection')
  const statusFilter = sp(searchParams, 'status') as Status | null
  const period = sp(searchParams, 'period') ?? 'all'
  const days = period === '7' ? 7 : period === '30' ? 30 : period === '90' ? 90 : null
  const since = days ? new Date(Date.now() - days * 86_400_000) : null

  // Commentable collections come from the comments collection's relatedDoc field.
  const commentsCfg = payload.config.collections.find((c) => c.slug === COMMENTS_SLUG)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const relatedField = commentsCfg?.fields?.find((f: any) => f.name === 'relatedDoc') as any
  const allCollections: string[] = Array.isArray(relatedField?.relationTo)
    ? relatedField.relationTo.map(String)
    : []

  // Date filter is safe to push to the DB; collection filter is applied in JS to
  // avoid relying on polymorphic-relationship query support (DB-agnostic).
  const where = since ? { createdAt: { greater_than_equal: since.toISOString() } } : {}

  const [found, reactionsCount] = await Promise.all([
    payload.find({
      collection: COMMENTS_SLUG,
      depth: 0,
      limit: 10_000,
      pagination: false,
      sort: '-createdAt',
      overrideAccess: true,
      req,
      where,
    }),
    payload
      .count({ collection: REACTIONS_SLUG, overrideAccess: true, req, where })
      .then((r) => r.totalDocs)
      .catch(() => 0),
  ])

  let docs: Doc[] = found.docs as Doc[]
  if (collFilter) docs = docs.filter((d) => relTo(d) === collFilter)

  // ── Aggregations ──
  const byStatus: Record<string, number> = { approved: 0, pending: 0, spam: 0, trash: 0 }
  const byCollection: Record<string, { total: number; approved: number }> = {}
  const byMood: Record<string, number> = {}
  for (const d of docs) {
    const st = String(d.status ?? 'pending')
    byStatus[st] = (byStatus[st] ?? 0) + 1
    const rt = relTo(d)
    byCollection[rt] = byCollection[rt] ?? { total: 0, approved: 0 }
    byCollection[rt].total += 1
    if (st === 'approved') byCollection[rt].approved += 1
    if (d.mood) byMood[String(d.mood)] = (byMood[String(d.mood)] ?? 0) + 1
  }
  const total = docs.length
  const collectionRows = Object.entries(byCollection).sort((a, b) => b[1].total - a[1].total)
  const moodRows = Object.entries(byMood).sort((a, b) => b[1] - a[1])
  const perDay = days ? (total / days).toFixed(1) : null

  let recent = docs
  if (statusFilter) recent = recent.filter((d) => String(d.status) === statusFilter)
  recent = recent.slice(0, 15)

  const kpis: { label: string; value: string | number; color?: string }[] = [
    { label: 'Total', value: total },
    { label: 'Approved', value: byStatus.approved, color: STATUS_COLOR.approved },
    { label: 'Pending', value: byStatus.pending, color: STATUS_COLOR.pending },
    { label: 'Spam', value: byStatus.spam, color: STATUS_COLOR.spam },
    { label: 'Trash', value: byStatus.trash, color: STATUS_COLOR.trash },
    { label: 'Reactions', value: reactionsCount },
  ]
  if (perDay) kpis.push({ label: 'Per day', value: perDay })

  // ── Styles (Payload theme tokens) ──
  const card: React.CSSProperties = {
    border: '1px solid var(--theme-elevation-150)',
    borderRadius: 'var(--style-radius-m, 6px)',
    background: 'var(--theme-elevation-50)',
    padding: '16px 18px',
  }
  const th: React.CSSProperties = {
    textAlign: 'left',
    padding: '8px 12px',
    borderBottom: '1px solid var(--theme-elevation-150)',
    color: 'var(--theme-elevation-500)',
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  }
  const td: React.CSSProperties = {
    padding: '8px 12px',
    borderBottom: '1px solid var(--theme-elevation-100)',
    fontSize: 13,
    verticalAlign: 'top',
  }
  const selectStyle: React.CSSProperties = {
    padding: '6px 10px',
    borderRadius: 4,
    border: '1px solid var(--theme-elevation-200)',
    background: 'var(--theme-input-bg, var(--theme-elevation-0))',
    color: 'var(--theme-text)',
    fontSize: 13,
  }
  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--theme-elevation-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      {children}
    </label>
  )

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={req.user ?? undefined}
      visibleEntities={visibleEntities}
    >
      <div className="gutter--left gutter--right" style={{ paddingTop: 24, paddingBottom: 48 }}>
        <h1 style={{ margin: '0 0 4px' }}>Comment Statistics</h1>
        <p style={{ margin: '0 0 24px', color: 'var(--theme-elevation-500)' }}>
          {since
            ? `Comments created in the last ${days} days`
            : 'All comments, all time'}
          {collFilter ? ` · ${collFilter}` : ''}
        </p>

        {/* Filters */}
        <form
          method="get"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end', marginBottom: 28 }}
        >
          <Field label="Collection">
            <select name="collection" defaultValue={collFilter ?? 'all'} style={selectStyle}>
              <option value="all">All collections</option>
              {allCollections.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status (table)">
            <select name="status" defaultValue={statusFilter ?? 'all'} style={selectStyle}>
              <option value="all">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Period">
            <select name="period" defaultValue={period} style={selectStyle}>
              <option value="all">All time</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </Field>
          <button type="submit" className="btn btn--style-primary btn--size-small" style={{ margin: 0 }}>
            Apply
          </button>
        </form>

        {/* KPIs */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 14,
            marginBottom: 28,
          }}
        >
          {kpis.map((k) => (
            <div key={k.label} style={card}>
              <div style={{ fontSize: 12, color: 'var(--theme-elevation-500)', marginBottom: 6 }}>{k.label}</div>
              <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1, color: k.color ?? 'var(--theme-text)' }}>
                {k.value}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 28 }}>
          {/* By collection */}
          <div style={card}>
            <h3 style={{ margin: '0 0 12px' }}>By collection</h3>
            {collectionRows.length === 0 ? (
              <p style={{ color: 'var(--theme-elevation-400)', margin: 0 }}>No comments in scope.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Collection</th>
                    <th style={{ ...th, textAlign: 'right' }}>Total</th>
                    <th style={{ ...th, textAlign: 'right' }}>Approved</th>
                  </tr>
                </thead>
                <tbody>
                  {collectionRows.map(([slug, v]) => (
                    <tr key={slug}>
                      <td style={td}>{slug}</td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v.total}</td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v.approved}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* By mood */}
          <div style={card}>
            <h3 style={{ margin: '0 0 12px' }}>By mood</h3>
            {moodRows.length === 0 ? (
              <p style={{ color: 'var(--theme-elevation-400)', margin: 0 }}>No moods set.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {moodRows.map(([mood, n]) => (
                  <div
                    key={mood}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 12px',
                      border: '1px solid var(--theme-elevation-150)',
                      borderRadius: 999,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{mood}</span>
                    <span style={{ color: 'var(--theme-elevation-500)', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent comments */}
        <div style={card}>
          <h3 style={{ margin: '0 0 12px' }}>
            Recent comments{statusFilter ? ` · ${statusFilter}` : ''}
          </h3>
          {recent.length === 0 ? (
            <p style={{ color: 'var(--theme-elevation-400)', margin: 0 }}>Nothing to show.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Author</th>
                  <th style={th}>Comment</th>
                  <th style={th}>On</th>
                  <th style={th}>Status</th>
                  <th style={th}>Date</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((d) => {
                  const st = String(d.status ?? 'pending') as Status
                  return (
                    <tr key={String(d.id)}>
                      <td style={td}>{String(d.authorName ?? 'Anonymous')}</td>
                      <td style={{ ...td, maxWidth: 360 }}>{snippet(d.content)}</td>
                      <td style={td}>{relTo(d)}</td>
                      <td style={td}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#fff',
                            background: STATUS_COLOR[st] ?? '#9ca3af',
                          }}
                        >
                          {st}
                        </span>
                      </td>
                      <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--theme-elevation-500)' }}>
                        {d.createdAt ? new Date(String(d.createdAt)).toLocaleDateString() : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DefaultTemplate>
  )
}
