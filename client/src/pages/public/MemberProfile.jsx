import { useParams } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { useApi } from '../../lib/useApi'
import { Card, Skeleton, ErrorState } from '../../components/ui'
export default function MemberProfile() {
  const { t } = useApp(); const { memberId } = useParams()
  const q = useApi(`/v1/public/members/${encodeURIComponent(memberId)}`)
  const m = q.data?.member || q.data || {}
  return <div className="space-y-4"><h1 className="text-3xl font-bold">{m.businessName || m.ownerName || memberId}</h1>
    {q.loading ? <Skeleton className="h-40" /> : q.error ? <ErrorState error={q.error} onRetry={q.refresh} /> :
    <Card><dl className="space-y-2 text-sm">
      <div><dt className="font-semibold">{t.memberId}</dt><dd>{m.memberId || memberId}</dd></div>
      <div><dt className="font-semibold">{t.ownerName}</dt><dd>{m.ownerName || '—'}</dd></div>
      <div><dt className="font-semibold">{t.businessName}</dt><dd>{m.businessName || '—'}</dd></div>
      <div><dt className="font-semibold">{t.status}</dt><dd>{m.status || '—'}</dd></div>
      {m.address && <div><dt className="font-semibold">{t.address}</dt><dd>{m.address}</dd></div>}
    </dl><p className="mt-4 text-sm text-slate-500">{t.balanceHidden}</p></Card>}
  </div>
}
