import { useApp } from '../../context/AppContext'
import { useApi } from '../../lib/useApi'
import { Card, Skeleton, ErrorState, EmptyState } from '../../components/ui'
import { formatDate } from '../../lib/format'
export default function Notices() {
  const { t } = useApp(); const q = useApi('/v1/public/notices')
  const items = Array.isArray(q.data) ? q.data : (q.data?.items || q.data?.notices || [])
  return <div className="space-y-4"><h1 className="text-3xl font-bold">{t.noticesTitle}</h1>
    {q.loading ? <Skeleton className="h-32" /> : q.error ? <ErrorState error={q.error} onRetry={q.refresh} /> :
    items.length ? items.map(n => <Card key={n.id}><h2 className="font-bold">{n.title}</h2><p className="text-sm text-slate-500">{formatDate(n.publishedAt || n.createdAt)}</p><p className="mt-1 whitespace-pre-line text-slate-700">{n.body || n.content || ''}</p></Card>) : <EmptyState />}
  </div>
}
