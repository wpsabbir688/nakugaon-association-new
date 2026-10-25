import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'
import { useApp } from '../../context/AppContext'
import { apiGet, apiSend, apiErrorMessage } from '../../lib/api'
import { useApi, usePaginatedList } from '../../lib/useApi'
import { Card, Field, inputCls, btnPrimary, btnGhost, DataTable, Skeleton, ErrorState, EmptyState, Pagination, useConfirm } from '../../components/ui'
import { formatBDT, formatDate } from '../../lib/format'
import { toCsv, downloadCsv } from '../../lib/csv'

const STAFF = ['SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT', 'OPERATOR']
export function PeriodFilter({ value, onChange, t }) {
  const opts = [['today', t.today], ['yesterday', t.yesterday], ['week', t.week], ['month', t.month], ['year', t.year], ['custom', t.custom]]
  return <div className="flex flex-wrap gap-2" role="group" aria-label={t.filter}>{opts.map(([v, l]) => <button key={v} onClick={() => onChange(v)} className={`rounded-full px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 ${value === v ? 'bg-teal-700 text-white' : 'border border-slate-300 bg-white'}`}>{l}</button>)}</div>
}
export function Dashboard() {
  const { t, lang } = useApp(); const [period, setPeriod] = useState('today')
  const summary = useApi('/v1/dashboard/summary', { period })
  const charts = useApi('/v1/dashboard/charts', { period })
  const recentVehicles = useApi('/v1/vehicle-entries', { limit: 5 })
  const recentPayments = useApi('/v1/payments', { limit: 5 })
  const d = summary.data || {}
  const cards = [
    [t.vehicleEntries, d.vehicleEntriesCount ?? d.vehicleEntries], [t.weighbridge, d.weighbridgeCount ?? d.weighbridge],
    [t.payments, d.totalPayments != null ? formatBDT(d.totalPayments) : d.payments], [t.expenses, d.totalExpenses != null ? formatBDT(d.totalExpenses) : d.expenses],
    [t.outstanding, d.outstanding != null ? formatBDT(d.outstanding) : d.totalOutstanding], [t.members, d.activeMembers ?? d.members],
  ]
  // API returns daily arrays (vehicleDaily/weighbridgeDaily/paymentDaily), NOT a
  // series array — merge them by date into one series for the chart.
  const chartData = (() => { const c = charts.data || {}; const byDate = {}
    for (const [arr, key] of [[c.vehicleDaily, 'vehicle'], [c.weighbridgeDaily, 'weighbridge'], [c.paymentDaily, 'payments']])
      for (const row of (arr || [])) { const d = row._id; byDate[d] = byDate[d] || { date: d, vehicle: 0, weighbridge: 0, payments: 0 }; byDate[d][key] = row.total ?? 0 }
    return Object.values(byDate).sort((a, b) => String(a.date).localeCompare(String(b.date))) })()
  return <div className="space-y-5"><h1 className="text-3xl font-bold">{t.dashboard}</h1><p className="text-slate-600">{t.dashboardSub}</p>
    <PeriodFilter value={period} onChange={setPeriod} t={t} />
    {summary.loading ? <div className="grid gap-4 sm:grid-cols-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
    : summary.error ? <ErrorState error={summary.error} onRetry={summary.refresh} />
    : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards.map(([label, val]) => <Card key={label}><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-navy">{val ?? '—'}</p></Card>)}</div>}
    <Card><h2 className="font-bold">{t.charts}</h2>
      {charts.loading ? <Skeleton className="mt-3 h-64" /> : charts.error ? <ErrorState error={charts.error} onRetry={charts.refresh} /> :
      chartData.length ? <div className="mt-3 h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip formatter={(v) => typeof v === 'number' ? formatBDT(v) : v} /><Bar dataKey="vehicle" fill="#0f766e" /><Bar dataKey="weighbridge" fill="#0ea5e9" /><Bar dataKey="payments" fill="#f59e0b" /></BarChart></ResponsiveContainer></div> : <div className="mt-3"><EmptyState /></div>}
    </Card>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><div className="flex justify-between"><h2 className="font-bold">{t.recentVehicleEntries}</h2><Link to={`/${lang}/admin/vehicle-entries`} className="font-semibold text-teal-700">{t.viewAll}</Link></div>
        {recentVehicles.loading ? <Skeleton className="mt-3 h-24" /> : recentVehicles.error ? <ErrorState error={recentVehicles.error} onRetry={recentVehicles.refresh} /> :
        (recentVehicles.data?.items || []).length ? <ul className="mt-3 space-y-2 text-sm">{(recentVehicles.data.items || []).map(r => <li key={r._id} className="flex justify-between border-b py-1"><span>{formatDate(r.entryDate || r.createdAt)} — {r.member ? `${r.member.memberId} — ${r.member.fullName || ''}` : ''} × {r.quantity ?? ''}</span><strong>{formatBDT(r.totalCharge ?? r.feeAmount ?? 0)}</strong></li>)}</ul> : <div className="mt-3"><EmptyState /></div>}
      </Card>
      <Card><div className="flex justify-between"><h2 className="font-bold">{t.recentReceipts}</h2><Link to={`/${lang}/admin/payments`} className="font-semibold text-teal-700">{t.viewAll}</Link></div>
        {recentPayments.loading ? <Skeleton className="mt-3 h-24" /> : recentPayments.error ? <ErrorState error={recentPayments.error} onRetry={recentPayments.refresh} /> :
        (recentPayments.data?.items || []).length ? <ul className="mt-3 space-y-2 text-sm">{(recentPayments.data.items || []).map(r => <li key={r._id} className="flex justify-between border-b py-1"><span>{formatDate(r.paymentDate || r.createdAt)} — {r.member ? `${r.member.memberId} — ${r.member.fullName || ''}` : ''} {r.receiptNo || ''}</span><strong>{formatBDT(r.amount ?? 0)}</strong></li>)}</ul> : <div className="mt-3"><EmptyState /></div>}
      </Card>
    </div>
    <Card><h2 className="font-bold">{t.ledger} / {t.reconciliation}</h2><LedgerBlock /></Card>
  </div>
}
function LedgerBlock() {
  const ledger = useApi('/v1/accounting/ledger'); const rec = useApi('/v1/accounting/reconciliation')
  const rows = Array.isArray(ledger.data) ? ledger.data : (ledger.data?.items || ledger.data?.entries || [])
  if (ledger.loading) return <Skeleton className="mt-3 h-24" />
  if (ledger.error) return <div className="mt-3"><ErrorState error={ledger.error} onRetry={ledger.refresh} /></div>
  return <div className="mt-3 space-y-3">{rec.data && <p className="text-sm text-slate-600">{JSON.stringify(rec.data).slice(0, 300)}</p>}
    <DataTable columns={[{ key: 'date', label: 'Date', render: r => formatDate(r.date || r.createdAt) }, { key: 'description', label: 'Description' }, { key: 'amount', label: 'Amount', render: r => formatBDT(r.amount ?? r.debit ?? 0) }]} rows={rows.slice(0, 20)} /></div>
}
export function MembersPage() {
  const { t, showToast } = useApp(); const { lang } = useParams(); const [search, setSearch] = useState('')
  const q = usePaginatedList('/v1/members', { search: '' })
  const { ask, dialog } = useConfirm()
  const archive = async (m) => { const ok = await ask({ title: t.archive, text: `${m.memberId} — ${m.ownerName || m.businessName || ''}` }); if (!ok) return; try { await apiSend('post', `/v1/members/${m.id || m.memberId}/archive`, {}); showToast(t.archive); q.refresh() } catch (e) { showToast(apiErrorMessage(e, 'Archive failed')) } }
  return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-3xl font-bold">{t.members}</h1><Link to={`/${lang}/admin/members/new`} className={btnPrimary}>{t.create}</Link></div>
    <form onSubmit={e => { e.preventDefault(); q.setParams(p => ({ ...p, page: 1, search })) }} className="flex gap-2"><input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.searchPlaceholder} className={`${inputCls} flex-1`} /><button className={btnPrimary}>{t.search}</button></form>
    {q.loading ? <Skeleton className="h-40" /> : q.error ? <ErrorState error={q.error} onRetry={q.refresh} /> :
    <DataTable columns={[
      { key: 'memberId', label: t.memberId }, { key: 'ownerName', label: t.ownerName }, { key: 'businessName', label: t.businessName },
      { key: 'status', label: t.status },
      { key: 'actions', label: t.actions, render: m => <span className="flex flex-wrap gap-2"><Link to={`/${lang}/admin/members/${m.id || m.memberId}`} className="font-semibold text-teal-700">{t.edit}</Link><Link to={`/${lang}/admin/members/${m.id || m.memberId}/statement`} className="font-semibold text-teal-700">{t.statement}</Link><button onClick={() => archive(m)} className="font-semibold text-red-700">{t.archive}</button></span> },
    ]} rows={q.items} />}
    <Pagination page={q.page} totalPages={q.totalPages} t={t} onChange={p => q.setParams(s => ({ ...s, page: p }))} />{dialog}
  </div>
}
export function MemberFormPage() {
  const { t, showToast } = useApp(); const { id } = useParams(); const isNew = id === 'new'
  const existing = useApi(isNew ? null : `/v1/members/${encodeURIComponent(id)}`)
  const m = existing.data?.member || existing.data || {}
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ values: isNew ? {} : { ownerName: m.ownerName || '', businessName: m.businessName || '', phone: m.phone || '', address: m.address || '' } })
  const onSubmit = async (v) => { try { if (isNew) await apiSend('post', '/v1/members', v); else await apiSend('patch', `/v1/members/${encodeURIComponent(id)}`, v); showToast(t.save) } catch (e) { showToast(apiErrorMessage(e, 'Save failed')) } }
  if (!isNew && existing.loading) return <Skeleton className="h-40" />
  if (!isNew && existing.error) return <ErrorState error={existing.error} onRetry={existing.refresh} />
  return <div className="mx-auto max-w-2xl"><Card><h1 className="text-2xl font-bold">{isNew ? t.create : t.edit} — {t.members}</h1>
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
      <Field label={t.ownerName} error={errors.ownerName && t.required}><input {...register('ownerName', { required: true })} className={inputCls} /></Field>
      <Field label={t.businessName} error={errors.businessName && t.required}><input {...register('businessName', { required: true })} className={inputCls} /></Field>
      <Field label={t.phone}><input {...register('phone')} className={inputCls} /></Field>
      <Field label={t.address}><textarea {...register('address')} className={inputCls} /></Field>
      <button disabled={isSubmitting} className={btnPrimary}>{t.save}</button>
    </form></Card></div>
}
export function StatementPage() {
  const { t } = useApp(); const { id } = useParams()
  const q = useApi(`/v1/members/${encodeURIComponent(id)}/statement`)
  const rows = Array.isArray(q.data) ? q.data : (q.data?.items || q.data?.entries || q.data?.statement || [])
  const total = q.data?.total ?? q.data?.outstanding ?? null
  return <div className="space-y-4"><div className="flex justify-between"><h1 className="text-3xl font-bold">{t.statement} — {id}</h1><button onClick={() => window.print()} className={`${btnGhost} no-print`}>{t.print}</button></div>
    {total != null && <Card><p>{t.outstanding}: <strong>{formatBDT(total)}</strong></p></Card>}
    {q.loading ? <Skeleton className="h-40" /> : q.error ? <ErrorState error={q.error} onRetry={q.refresh} /> :
    <DataTable columns={[{ key: 'date', label: t.date, render: r => formatDate(r.date || r.createdAt) }, { key: 'description', label: 'Description' }, { key: 'amount', label: t.amount, render: r => formatBDT(r.amount ?? 0) }]} rows={rows} />}
  </div>
}
