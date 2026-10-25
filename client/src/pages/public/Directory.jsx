import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { usePaginatedList } from '../../lib/useApi'
import { Card, Skeleton, ErrorState, Pagination, inputCls } from '../../components/ui'
export default function Directory() {
  const { lang, t } = useApp(); const { lang: l } = useParams()
  const [search, setSearch] = useState(''); const [status, setStatus] = useState('')
  const q = usePaginatedList('/v1/public/members', { search: '', status: '' })
  const apply = (e) => { e.preventDefault(); q.setParams(p => ({ ...p, page: 1, search, status })) }
  return <div className="space-y-5"><h1 className="text-3xl font-bold">{t.directoryTitle}</h1><p className="text-slate-600">{t.directorySub} {t.balanceHidden}</p>
    <form onSubmit={apply} className="flex flex-col gap-2 rounded-2xl border bg-white p-4 sm:flex-row">
      <label className="sr-only" htmlFor="dir-search">{t.search}</label>
      <input id="dir-search" value={search} onChange={e => setSearch(e.target.value)} placeholder={t.searchPlaceholder} className={`${inputCls} flex-1`} />
      <label className="sr-only" htmlFor="dir-status">{t.status}</label>
      <select id="dir-status" value={status} onChange={e => setStatus(e.target.value)} className={inputCls}><option value="">{t.all}</option><option value="active">{t.active}</option><option value="archived">{t.archived}</option></select>
      <button className="rounded-full bg-teal-700 px-5 py-2.5 font-semibold text-white">{t.search}</button>
    </form>
    {q.loading ? <Skeleton className="h-40" /> : q.error ? <ErrorState error={q.error} onRetry={q.refresh} /> :
    q.items.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{q.items.map(m => <Card key={m.id || m.memberId}><p className="font-bold">{m.businessName || m.ownerName}</p><p className="text-sm text-slate-500">{m.memberId} • {m.ownerName || ''}</p><p className="text-sm">{m.status || ''}</p><Link to={`/${l}/members/${m.memberId}`} className="mt-2 inline-block font-semibold text-teal-700">{t.viewAll} →</Link></Card>)}</div> : <Card><p>{t.noData}</p></Card>}
    <Pagination page={q.page} totalPages={q.totalPages} t={t} onChange={p => q.setParams(s => ({ ...s, page: p }))} />
  </div>
}
