import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { useApp } from '../../context/AppContext'
import { apiSend, apiErrorMessage } from '../../lib/api'
import { useApi, usePaginatedList } from '../../lib/useApi'
import { Card, Field, inputCls, btnPrimary, btnGhost, DataTable, Skeleton, ErrorState, EmptyState, Pagination, useConfirm } from '../../components/ui'
import { formatBDT, formatDate, formatDateTime } from '../../lib/format'
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
    </form></Card>
    <DatabaseStatusCard />
  </div>
}
export function DatabaseStatusCard() {
  const { t } = useApp(); const q = useApi('/v1/settings/status')
  const d = q.data || {}; const counts = d.counts || {}
  // Read-only status only — deliberately NO reset/seed/destructive action here.
  return <Card><h2 className="font-bold">{t.databaseStatus}</h2>
    {q.loading ? <Skeleton className="mt-3 h-24" /> : q.error ? <ErrorState error={q.error} onRetry={q.refresh} /> :
    <div className="mt-3 space-y-2 text-sm"><p>{t.dbConnected}: <strong>{d.db?.connected ? t.active : '—'}</strong></p>
      <p>{d.app?.name || ''} v{d.app?.version || ''}</p>
      <ul className="grid gap-1 sm:grid-cols-2">{Object.entries(counts).map(([k, v]) => <li key={k} className="flex justify-between border-b py-1"><span>{k}</span><strong>{v}</strong></li>)}</ul></div>}
  </Card>
}
export function ChangePasswordPage() {
  const { t, lang, showToast, logout } = useApp(); const navigate = useNavigate()
  const { register, handleSubmit, reset, setError, formState: { isSubmitting, errors } } = useForm()
  const save = async (v) => {
    const schema = z.object({
      currentPassword: z.string().min(1, t.required),
      newPassword: z.string().min(8, t.passwordTooShort).max(128),
      confirmPassword: z.string().min(8).max(128),
    }).refine(d => d.confirmPassword === d.newPassword, { message: t.passwordsDoNotMatch, path: ['confirmPassword'] })
      .refine(d => d.newPassword !== d.currentPassword, { message: t.passwordSameAsCurrent, path: ['newPassword'] })
    const parsed = schema.safeParse(v)
    if (!parsed.success) { parsed.error.issues.forEach(i => setError(i.path[0], { message: i.message })); return }
    try {
      await apiSend('post', '/v1/auth/change-password', parsed.data)
      showToast(t.passwordChanged); reset()
      await logout(); navigate(`/${lang}/login`)
    } catch (e) { showToast(apiErrorMessage(e, t.passwordChangeFailed)) }
  }
  return <div className="mx-auto max-w-2xl"><Card><h1 className="text-2xl font-bold">{t.changePassword}</h1><p className="mt-1 text-sm text-slate-500">{t.passwordChangeNote}</p>
    <form onSubmit={handleSubmit(save)} className="mt-4 space-y-4">
      <Field label={t.currentPassword} error={errors.currentPassword?.message}><input type="password" autoComplete="current-password" {...register('currentPassword', { required: t.required })} className={inputCls} /></Field>
      <Field label={t.newPassword} error={errors.newPassword?.message}><input type="password" autoComplete="new-password" {...register('newPassword', { required: t.required })} className={inputCls} /></Field>
      <Field label={t.confirmNewPassword} error={errors.confirmPassword?.message}><input type="password" autoComplete="new-password" {...register('confirmPassword', { required: t.required })} className={inputCls} /></Field>
      <button disabled={isSubmitting} className={btnPrimary}>{t.changePassword}</button>
    </form></Card></div>
}
export function AuditPage() {
  const { t } = useApp(); const [action, setAction] = useState(''); const [recordType, setRecordType] = useState('')
  const q = usePaginatedList('/v1/accounting/audit-logs')
  return <div className="space-y-4"><h1 className="text-3xl font-bold">{t.auditLog}</h1>
    <Card><form onSubmit={e => { e.preventDefault(); q.setParams(p => ({ ...p, page: 1, action: action || undefined, recordType: recordType || undefined })) }} className="flex flex-wrap gap-2">
      <input value={action} onChange={e => setAction(e.target.value)} placeholder="Action" className={inputCls} />
      <input value={recordType} onChange={e => setRecordType(e.target.value)} placeholder="Record type" className={inputCls} />
      <button className={btnPrimary}>{t.filter}</button></form></Card>
    {q.loading ? <Skeleton className="h-40" /> : q.error ? <ErrorState error={q.error} onRetry={q.refresh} /> :
    q.items.length ? <DataTable columns={[
      { key: 'date', label: t.date, render: r => formatDateTime(r.createdAt) },
      { key: 'actor', label: t.email, render: r => r.actor ? `${r.actor.email || ''} (${r.actor.role || ''})` : '—' },
      { key: 'action', label: 'Action' }, { key: 'recordType', label: 'Record type' }, { key: 'recordId', label: 'Record ID' },
    ]} rows={q.items} /> : <EmptyState title={t.auditUnavailable} />}
    <Pagination page={q.page} totalPages={q.totalPages} t={t} onChange={p => q.setParams(s2 => ({ ...s2, page: p }))} />
  </div>
}
export function LeadersManage() {
  const { t, showToast } = useApp(); const q = usePaginatedList('/v1/leaders'); const [showForm, setShowForm] = useState(false); const [editId, setEditId] = useState(null)
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm()
  const { ask, dialog } = useConfirm()
  const save = async (v) => { try { const body = { ...v, displayOrder: v.displayOrder === '' || v.displayOrder == null ? 0 : Number(v.displayOrder) }; if (editId) await apiSend('patch', `/v1/leaders/${editId}`, body); else await apiSend('post', '/v1/leaders', body); showToast(t.save); reset(); setShowForm(false); setEditId(null); q.refresh() } catch (e) { showToast(apiErrorMessage(e, 'Save failed')) } }
  const remove = async (r) => { const ok = await ask({ title: t.remove, text: `${r.nameBn || ''} — ${r.designationBn || ''}` }); if (!ok) return; try { await apiSend('patch', `/v1/leaders/${r._id}`, { active: false }); showToast(t.archive); q.refresh() } catch (e) { showToast(apiErrorMessage(e, 'Archive failed')) } }
  return <div className="space-y-4"><div className="flex justify-between"><h1 className="text-3xl font-bold">{t.leaders}</h1><button onClick={() => { setShowForm(!showForm); setEditId(null); reset() }} className={btnPrimary}>{t.newLeader}</button></div>
    {showForm && <Card><form onSubmit={handleSubmit(save)} className="grid gap-4 sm:grid-cols-2">
      <Field label={`${t.name} (BN) *`}><input {...register('nameBn', { required: true })} className={inputCls} /></Field>
      <Field label={`${t.name} (EN)`}><input {...register('nameEn')} className={inputCls} /></Field>
      <Field label={`${t.designation} (BN) *`}><input placeholder="Executive Member" {...register('designationBn', { required: true })} className={inputCls} /></Field>
      <Field label={`${t.designation} (EN)`}><input placeholder="Executive Member" {...register('designationEn')} className={inputCls} /></Field>
      <Field label={t.firm}><input {...register('firm')} className={inputCls} /></Field>
      <Field label={t.displayOrder}><input type="number" step="1" {...register('displayOrder')} className={inputCls} /></Field>
      <Field label={t.phone}><input {...register('mobile')} className={inputCls} /></Field>
      <Field label={t.photoUrl}><input placeholder="https://" {...register('photoUrl')} className={inputCls} /></Field>
      <div className="sm:col-span-2"><button disabled={isSubmitting} className={btnPrimary}>{t.save}</button></div></form></Card>}
    {q.loading ? <Skeleton className="h-40" /> : q.error ? <ErrorState error={q.error} onRetry={q.refresh} /> :
    <DataTable columns={[
      { key: 'nameBn', label: `${t.name} (BN)` }, { key: 'nameEn', label: `${t.name} (EN)` },
      { key: 'designationBn', label: `${t.designation} (BN)` }, { key: 'firm', label: t.firm },
      { key: 'displayOrder', label: t.displayOrder }, { key: 'status', label: t.status, render: r => r.active ? t.active : t.archived },
      { key: 'actions', label: t.actions, render: r => <span className="flex gap-2"><button onClick={() => { setEditId(r._id); setShowForm(true); reset({ nameBn: r.nameBn || '', nameEn: r.nameEn || '', designationBn: r.designationBn || '', designationEn: r.designationEn || '', firm: r.firm || '', displayOrder: r.displayOrder ?? 0, mobile: r.mobile || '', photoUrl: r.photoUrl || '' }) }} className="font-semibold text-teal-700">{t.edit}</button>{r.active && <button onClick={() => remove(r)} className="font-semibold text-red-700">{t.remove}</button>}</span> },
    ]} rows={q.items} />}
    <Pagination page={q.page} totalPages={q.totalPages} t={t} onChange={p => q.setParams(s2 => ({ ...s2, page: p }))} />{dialog}
  </div>
}
export function LedgerPage() {
  const { t } = useApp(); const { lang } = useParams(); const [memberId, setMemberId] = useState(''); const [kind, setKind] = useState('')
  const q = usePaginatedList('/v1/accounting/ledger')
  return <div className="space-y-4"><h1 className="text-3xl font-bold">{t.memberLedger}</h1>
    <Card><form onSubmit={e => { e.preventDefault(); q.setParams(p => ({ ...p, page: 1, memberId: memberId || undefined, kind: kind || undefined })) }} className="flex flex-wrap gap-2">
      <input value={memberId} onChange={e => setMemberId(e.target.value)} placeholder={t.memberId} className={inputCls} />
      <select value={kind} onChange={e => setKind(e.target.value)} className={inputCls}>{['', 'opening', 'charge', 'payment', 'credit', 'unapplied'].map(k => <option key={k} value={k}>{k || t.all}</option>)}</select>
      <button className={btnPrimary}>{t.filter}</button></form></Card>
    {q.loading ? <Skeleton className="h-40" /> : q.error ? <ErrorState error={q.error} onRetry={q.refresh} /> :
    <DataTable columns={[
      { key: 'date', label: t.date, render: r => formatDate(r.postedAt || r.createdAt) },
      { key: 'member', label: t.memberId, render: r => r.member ? `${r.member.memberId} — ${r.member.fullName || ''}` : '—' },
      { key: 'kind', label: t.kind }, { key: 'description', label: t.subject },
      { key: 'debit', label: t.debit, render: r => formatBDT(r.debit ?? 0) }, { key: 'credit', label: t.credit, render: r => formatBDT(r.credit ?? 0) },
      { key: 'statement', label: t.statement, render: r => r.member?.memberId ? <Link to={`/${lang}/admin/members/${r.member.memberId}/statement`} className="font-semibold text-teal-700">{t.statement}</Link> : '—' },
    ]} rows={q.items} />}
    <Pagination page={q.page} totalPages={q.totalPages} t={t} onChange={p => q.setParams(s2 => ({ ...s2, page: p }))} />
  </div>
}
export function AccountsPage() {
  const { t } = useApp(); const q = useApi('/v1/accounting/accounts')
  const rows = q.data?.items || []
  return <div className="space-y-4"><h1 className="text-3xl font-bold">{t.chartOfAccounts}</h1>
    <Card><p className="text-sm text-slate-600">Balances are summed from journal lines only. With no transactions this list is empty — no balances are invented.</p></Card>
    {q.loading ? <Skeleton className="h-40" /> : q.error ? <ErrorState error={q.error} onRetry={q.refresh} /> :
    rows.length ? <DataTable columns={[
      { key: 'code', label: t.code }, { key: 'name', label: t.name }, { key: 'type', label: t.accountType },
      { key: 'debit', label: t.debit, render: r => formatBDT(r.debit ?? 0) }, { key: 'credit', label: t.credit, render: r => formatBDT(r.credit ?? 0) },
      { key: 'balance', label: t.balance, render: r => formatBDT(r.balance ?? 0) },
    ]} rows={rows} /> : <EmptyState />}
  </div>
}
