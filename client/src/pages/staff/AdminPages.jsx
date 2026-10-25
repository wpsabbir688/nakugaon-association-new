import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useApp } from '../../context/AppContext'
import { apiSend, apiErrorMessage } from '../../lib/api'
import { useApi, usePaginatedList } from '../../lib/useApi'
import { Card, Field, inputCls, btnPrimary, btnGhost, DataTable, Skeleton, ErrorState, EmptyState, Pagination, useConfirm } from '../../components/ui'
import { formatBDT, formatDate } from '../../lib/format'
import { toCsv, downloadCsv } from '../../lib/csv'

export function NoticesManage() {
  const { t, showToast } = useApp(); const q = usePaginatedList('/v1/notices'); const [showForm, setShowForm] = useState(false); const [editId, setEditId] = useState(null)
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm()
  const save = async (v) => { try { if (editId) await apiSend('patch', `/v1/notices/${editId}`, v); else await apiSend('post', '/v1/notices', v); showToast(t.save); reset(); setShowForm(false); setEditId(null); q.refresh() } catch (e) { showToast(apiErrorMessage(e, 'Save failed')) } }
  return <div className="space-y-4"><div className="flex justify-between"><h1 className="text-3xl font-bold">{t.noticesManage}</h1><button onClick={() => { setShowForm(!showForm); setEditId(null); reset() }} className={btnPrimary}>{t.newNotice}</button></div>
    {showForm && <Card><form onSubmit={handleSubmit(save)} className="space-y-4"><Field label={t.subject}><input {...register('title', { required: true })} className={inputCls} /></Field><Field label={t.message}><textarea rows={5} {...register('body', { required: true })} className={inputCls} /></Field><button disabled={isSubmitting} className={btnPrimary}>{t.save}</button></form></Card>}
    {q.loading ? <Skeleton className="h-32" /> : q.error ? <ErrorState error={q.error} onRetry={q.refresh} /> :
    <DataTable columns={[{ key: 'title', label: t.subject }, { key: 'date', label: t.date, render: r => formatDate(r.publishedAt || r.createdAt) }, { key: 'actions', label: t.actions, render: r => <button onClick={() => { setEditId(r.id); setShowForm(true); reset({ title: r.title, body: r.body || r.content || '' }) }} className="font-semibold text-teal-700">{t.edit}</button> }]} rows={q.items} />}
    <Pagination page={q.page} totalPages={q.totalPages} t={t} onChange={p => q.setParams(s => ({ ...s, page: p }))} />
  </div>
}
export function Reports() {
  const { t } = useApp(); const [kind, setKind] = useState('daily'); const [memberId, setMemberId] = useState('')
  const path = '/v1/accounting/reports'
  const q = useApi(path, { type: kind, memberId: memberId || undefined })
  const rows = Array.isArray(q.data) ? q.data : (q.data?.items || q.data?.rows || [])
  const exportCsv = () => { if (!rows.length) return; const headers = Object.keys(rows[0]); downloadCsv(`nakugaon-${kind}-report.csv`, toCsv(rows, headers)) }
  return <div className="space-y-4"><div className="flex flex-wrap justify-between gap-2"><h1 className="text-3xl font-bold">{t.reports}</h1><div className="flex gap-2 no-print"><button onClick={exportCsv} disabled={!rows.length} className={btnGhost}>{t.exportCsv}</button><button onClick={() => window.print()} className={btnGhost}>{t.print}</button></div></div>
    <Card><div className="flex flex-wrap gap-2">
      {['daily', 'monthly', 'member'].map(k => <button key={k} onClick={() => setKind(k)} className={`rounded-full px-4 py-2 text-sm font-semibold ${kind === k ? 'bg-teal-700 text-white' : 'border'}`}>{k}</button>)}
      {kind === 'member' && <input value={memberId} onChange={e => setMemberId(e.target.value)} placeholder={t.memberId} className={inputCls} />}
    </div><p className="mt-2 text-sm text-slate-500">Reports are served from GET /api/v1/reports with type + memberId filters; CSV values are escaped against formula injection.</p></Card>
    {q.loading ? <Skeleton className="h-32" /> : q.error ? <ErrorState error={q.error} onRetry={q.refresh} /> :
    rows.length ? <DataTable columns={Object.keys(rows[0]).slice(0, 6).map(k => ({ key: k, label: k, render: r => typeof r[k] === 'number' && /amount|total|balance/i.test(k) ? formatBDT(r[k]) : String(r[k] ?? '—') }))} rows={rows} /> : <EmptyState />}
  </div>
}
export function SettingsPage() {
  const { t, showToast } = useApp(); const q = useApi('/v1/settings'); const s = q.data?.settings || q.data || {}
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({ values: { orgName: s.orgName || '', contactPhone: s.contactPhone || '', contactEmail: s.contactEmail || '', address: s.address || '', mission: s.mission || '', disclosureEnabled: s.disclosureEnabled || s.publicBalanceDisclosure || false } })
  const save = async (v) => { try { await apiSend('patch', '/v1/settings', v); showToast(t.save); q.refresh() } catch (e) { showToast(apiErrorMessage(e, 'Save failed')) } }
  if (q.loading) return <Skeleton className="h-64" />
  if (q.error) return <ErrorState error={q.error} onRetry={q.refresh} />
  return <div className="mx-auto max-w-2xl"><Card><h1 className="text-2xl font-bold">{t.settings}</h1><p className="mt-1 text-sm text-slate-500">{t.balanceHidden} — {t.balance} disclosure follows the flag returned by this API.</p>
    <form onSubmit={handleSubmit(save)} className="mt-4 space-y-4">
      <Field label={t.orgName}><input {...register('orgName')} className={inputCls} /></Field>
      <Field label={t.phone}><input {...register('contactPhone')} className={inputCls} /></Field>
      <Field label={t.email}><input type="email" {...register('contactEmail')} className={inputCls} /></Field>
      <Field label={t.address}><textarea {...register('address')} className={inputCls} /></Field>
      <Field label={t.missionTitle}><textarea rows={4} {...register('mission')} className={inputCls} /></Field>
      <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" {...register('disclosureEnabled')} className="h-5 w-5 accent-teal-700" /> Public balance disclosure enabled (only if the association approves)</label>
      <button disabled={isSubmitting} className={btnPrimary}>{t.save}</button>
    </form></Card></div>
}
export function AuditPage() {
  const { t } = useApp()
  // No audit endpoint exists in the API contract — show this honestly, invent no logs.
  return <div className="space-y-4"><h1 className="text-3xl font-bold">{t.auditLog}</h1><Card><p className="text-slate-700">{t.auditUnavailable}</p></Card></div>
}
