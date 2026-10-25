import { useApp } from '../../context/AppContext'
import { useApi } from '../../lib/useApi'
import { Card, Skeleton, ErrorState, EmptyState } from '../../components/ui'
export default function About() {
  const { t, lang } = useApp(); const q = useApi('/v1/public/settings'); const leadersQ = useApi('/v1/public/leaders')
  const s = q.data || {}
  const sections = [
    ['history', s.history], ['mission', s.mission], ['objectives', s.objectives], ['leadership', s.committee || s.leadership], ['activities', s.activities], ['facilities', s.facilities],
  ]
  return <div className="space-y-6"><h1 className="text-3xl font-bold">{t.about}</h1><p className="text-slate-600">{t.orgName}</p>
    {q.loading ? <Skeleton className="h-40" /> : q.error ? <ErrorState error={q.error} onRetry={q.refresh} /> :
    sections.map(([k, v]) => <Card key={k}><h2 className="font-bold capitalize">{k}</h2>{v ? <p className="mt-1 whitespace-pre-line text-slate-700">{Array.isArray(v) ? v.map(x => typeof x === 'string' ? x : (x.name || JSON.stringify(x))).join('\n') : v}</p> : <EmptyState title={t.emptySettings} />}</Card>)}
    <Card><h2 className="font-bold">{t.leadersSection}</h2>
      {leadersQ.loading ? <Skeleton className="mt-3 h-24" /> : leadersQ.error ? <ErrorState error={leadersQ.error} onRetry={leadersQ.refresh} /> :
      (leadersQ.data?.items || []).length ? <ul className="mt-3 space-y-3">{(leadersQ.data.items || []).map(l => <li key={l._id} className="flex items-center gap-3">{l.photoUrl && <img src={l.photoUrl} alt="" className="h-12 w-12 rounded-full object-cover" />}<span><span className="block font-semibold">{lang === 'bn' ? (l.nameBn || l.nameEn) : (l.nameEn || l.nameBn)}</span><span className="block text-sm text-slate-600">{lang === 'bn' ? (l.designationBn || l.designationEn) : (l.designationEn || l.designationBn)}{l.firm ? ` — ${l.firm}` : ''}</span></span></li>)}</ul> : <div className="mt-3"><EmptyState title={t.emptySettings} /></div>}
    </Card>
  </div>
}
