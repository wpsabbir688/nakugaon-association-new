import { useApp } from '../../context/AppContext'
import { useApi } from '../../lib/useApi'
import { Card, Skeleton, ErrorState, EmptyState } from '../../components/ui'
export default function About() {
  const { t } = useApp(); const q = useApi('/v1/public/settings')
  const s = q.data || {}
  const sections = [
    ['history', s.history], ['mission', s.mission], ['objectives', s.objectives], ['leadership', s.committee || s.leadership], ['activities', s.activities], ['facilities', s.facilities],
  ]
  return <div className="space-y-6"><h1 className="text-3xl font-bold">{t.about}</h1><p className="text-slate-600">{t.orgName}</p>
    {q.loading ? <Skeleton className="h-40" /> : q.error ? <ErrorState error={q.error} onRetry={q.refresh} /> :
    sections.map(([k, v]) => <Card key={k}><h2 className="font-bold capitalize">{k}</h2>{v ? <p className="mt-1 whitespace-pre-line text-slate-700">{Array.isArray(v) ? v.map(x => typeof x === 'string' ? x : (x.name || JSON.stringify(x))).join('\n') : v}</p> : <EmptyState title={t.emptySettings} />}</Card>)}
  </div>
}
