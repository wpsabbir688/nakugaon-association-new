import { Link, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useApp } from '../../context/AppContext'
import { useApi } from '../../lib/useApi'
import { Card, Field, inputCls, btnPrimary, DataTable, Skeleton, ErrorState, EmptyState } from '../../components/ui'
import { formatBDT, formatDate } from '../../lib/format'

export function Portal() {
  const { t, user } = useApp(); const { lang } = useParams()
  const me = useApi('/v1/auth/me')
  const memberId = user?.memberId || me.data?.user?.memberId || me.data?.memberId
  const profile = useApi(memberId ? `/v1/members/${encodeURIComponent(memberId)}` : null)
  const statement = useApi(memberId ? `/v1/members/${encodeURIComponent(memberId)}/statement` : null)
  const sRows = Array.isArray(statement.data) ? statement.data : (statement.data?.items || statement.data?.entries || [])
  const outstanding = statement.data?.outstanding ?? statement.data?.total ?? null
  return <div className="space-y-5"><h1 className="text-3xl font-bold">{t.navPortal}</h1>
    {outstanding != null && <Card><p>{t.outstanding}: <strong className="text-xl text-navy">{formatBDT(outstanding)}</strong></p></Card>}
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><h2 className="font-bold">{t.myProfile}</h2>{profile.loading ? <Skeleton className="mt-3 h-24" /> : profile.error ? <ErrorState error={profile.error} onRetry={profile.refresh} /> : <div className="mt-2 text-sm"><p>{t.memberId}: {memberId || '—'}</p><p>{t.ownerName}: {(profile.data?.member || profile.data)?.ownerName || user?.name || '—'}</p><p>{t.businessName}: {(profile.data?.member || profile.data)?.businessName || '—'}</p></div>}</Card>
      <Card><h2 className="font-bold">{t.myCharges}</h2><p className="mt-2 text-sm text-slate-600">{t.statement} below shows your own charges and payments only.</p><Link to={`/${lang}/portal/correction`} className="mt-2 inline-block font-semibold text-teal-700">Profile correction →</Link></Card>
    </div>
    <Card><h2 className="font-bold">{t.myHistory}</h2>
      {statement.loading ? <Skeleton className="mt-3 h-32" /> : statement.error ? <ErrorState error={statement.error} onRetry={statement.refresh} /> :
      <div className="mt-3"><DataTable columns={[{ key: 'date', label: t.date, render: r => formatDate(r.date || r.createdAt) }, { key: 'description', label: 'Description' }, { key: 'amount', label: t.amount, render: r => formatBDT(r.amount ?? 0) }]} rows={sRows} /></div>}
    </Card>
    <Card><h2 className="font-bold">{t.receipt}</h2><p className="mt-1 text-sm text-slate-600">Receipts are printable from the staff receipt view and from your statement (browser print).</p><button onClick={() => window.print()} className={`${btnPrimary} no-print mt-2`}>{t.print}</button></Card>
  </div>
}
export function Correction() {
  const { t } = useApp(); const { register, handleSubmit } = useForm()
  // No correction endpoint in the contract: the form is present but submission is honest, not claimed.
  return <div className="mx-auto max-w-2xl"><Card><h1 className="text-2xl font-bold">Profile correction</h1><p className="mt-2 text-sm text-slate-600">{t.correctionNote}</p>
    <form onSubmit={handleSubmit(() => alert(t.correctionNote))} className="mt-4 space-y-4">
      <Field label={t.name}><input {...register('name')} className={inputCls} /></Field>
      <Field label={t.message}><textarea rows={5} {...register('message')} className={inputCls} /></Field>
      <button className={btnPrimary}>{t.submit}</button>
    </form></Card></div>
}
