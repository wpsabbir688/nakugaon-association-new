import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { apiSend, apiErrorMessage } from '../../lib/api'
import { useApi, usePaginatedList } from '../../lib/useApi'
import { Card, Field, inputCls, btnPrimary, btnGhost, DataTable, Skeleton, ErrorState, Pagination, useConfirm } from '../../components/ui'
import { formatBDT, formatDate } from '../../lib/format'

// Generic list + create + reverse pattern shared by vehicle entries, weighbridge, payments, expenses.
function ReverseButton({ onReverse }) {
  const { t } = useApp(); const { ask, dialog } = useConfirm()
  return <>{dialog}<button onClick={async () => { const ok = await ask({ title: t.reverse, text: t.confirmHighImpact }); if (ok) onReverse() }} className="font-semibold text-red-700">{t.reverse}</button></>
}
function CrudList({ title, listPath, createPath, reversePath, columns, formFields, createLabel, feeNote }) {
  const { t, showToast } = useApp(); const [showForm, setShowForm] = useState(false)
  const q = usePaginatedList(listPath)
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm()
  const create = async (v) => { const body = {}; for (const [k, val] of Object.entries(v)) body[k] = k === 'amount' ? Math.round(Number(val)) : val; try { await apiSend('post', createPath, body); showToast(t.save); reset(); setShowForm(false); q.refresh() } catch (e) { showToast(apiErrorMessage(e, 'Save failed')) } }
  const reverse = async (row) => { try { await apiSend('post', reversePath(row), {}); showToast(t.reverse); q.refresh() } catch (e) { showToast(apiErrorMessage(e, 'Reverse failed')) } }
  return <div className="space-y-4"><div className="flex flex-wrap justify-between gap-2"><h1 className="text-3xl font-bold">{title}</h1><button onClick={() => setShowForm(!showForm)} className={btnPrimary}>{createLabel}</button></div>
    {feeNote && <Card><p className="text-sm text-slate-600">{feeNote}</p></Card>}
    {showForm && <Card><form onSubmit={handleSubmit(create)} className="grid gap-4 sm:grid-cols-2">
      {formFields.map(f => <Field key={f.name} label={f.label}>{f.type === 'select' ? <select {...register(f.name, { required: f.required })} className={inputCls}>{f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select> : <input type={f.type || 'text'} step={f.type === 'number' ? '1' : undefined} {...register(f.name, { required: f.required })} className={inputCls} />}</Field>)}
      <div className="sm:col-span-2"><button disabled={isSubmitting} className={btnPrimary}>{t.save}</button></div>
    </form></Card>}
    {q.loading ? <Skeleton className="h-40" /> : q.error ? <ErrorState error={q.error} onRetry={q.refresh} /> :
    <DataTable columns={[...columns, ...(reversePath ? [{ key: 'actions', label: t.actions, render: r => <ReverseButton onReverse={() => reverse(r)} /> }] : [])]} rows={q.items} />}
    <Pagination page={q.page} totalPages={q.totalPages} t={t} onChange={p => q.setParams(s => ({ ...s, page: p }))} />
  </div>
}
// Quantity-based vehicle entries (Phase 8): one entry = N vehicles, no per-vehicle
// number/driver fields. Fee-per-vehicle comes from GET /api/v1/fee-rules; the
// total shown in the form is quantity x that rate, and the server-calculated
// total from the create response is shown on save.
export function VehicleEntries() {
  const { t, showToast } = useApp(); const [showForm, setShowForm] = useState(false)
  const q = usePaginatedList('/v1/vehicle-entries')
  const membersQ = useApi('/v1/members', { limit: 100 })
  const feesQ = useApi('/v1/fee-rules', { scope: 'vehicle', limit: 100 })
  const members = membersQ.data?.items || []
  const feeRows = feesQ.data?.items || []
  const now = new Date()
  const rule = feeRows.filter(r => r.category === 'standard' && r.active !== false && new Date(r.effectiveFrom) <= now && (!r.effectiveTo || new Date(r.effectiveTo) > now)).sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom))[0]
  const feePerVehicle = rule ? rule.amount : null
  const { register, handleSubmit, reset, watch, formState: { isSubmitting } } = useForm({ defaultValues: { quantity: 1 } })
  const qty = Number(watch('quantity'))
  const qtyValid = Number.isInteger(qty) && qty > 0
  const total = qtyValid && feePerVehicle != null ? qty * feePerVehicle : null
  const create = async (v) => {
    const quantity = Number(v.quantity)
    if (!Number.isInteger(quantity) || quantity <= 0) { showToast(t.quantityInvalid); return }
    const body = { memberId: v.memberId, quantity, notes: v.notes || '' }
    if (v.entryDate) body.entryDate = new Date(v.entryDate).toISOString()
    try { const created = await apiSend('post', '/v1/vehicle-entries', body); showToast(`${t.save} — ${t.totalCharge}: ${formatBDT(created?.totalCharge ?? created?.feeAmount ?? total ?? 0)}`); reset({ quantity: 1 }); setShowForm(false); q.refresh() } catch (e) { showToast(apiErrorMessage(e, 'Save failed')) }
  }
  const reverse = async (row) => { try { await apiSend('post', `/v1/vehicle-entries/${row._id || row.id}/reverse`, { reason: t.reverse }); showToast(t.reverse); q.refresh() } catch (e) { showToast(apiErrorMessage(e, 'Reverse failed')) } }
  return <div className="space-y-4"><div className="flex flex-wrap justify-between gap-2"><h1 className="text-3xl font-bold">{t.vehicleEntries}</h1><button onClick={() => setShowForm(!showForm)} className={btnPrimary}>{t.newEntry}</button></div>
    <Card><p className="text-sm text-slate-600">{t.feeNote}</p>{feesQ.loading ? <p className="mt-2 text-sm text-slate-500">{t.loading}</p> : feePerVehicle != null ? <p className="mt-2 text-sm font-semibold text-slate-800">{t.feePerVehicle}: {formatBDT(feePerVehicle)}</p> : <p className="mt-2 text-sm font-semibold text-red-700">{t.noVehicleFeeRule}</p>}</Card>
    {showForm && <Card><form onSubmit={handleSubmit(create)} className="grid gap-4 sm:grid-cols-2">
      <Field label={t.memberId}>{membersQ.loading ? <p className="text-sm text-slate-500">{t.loading}</p> : membersQ.error ? <p className="text-sm text-red-600">{membersQ.error}</p> : <select {...register('memberId', { required: true })} className={inputCls}><option value="">{t.memberId}</option>{members.map(m => <option key={m._id || m.memberId} value={m.memberId}>{m.memberId} — {m.fullName || m.businessName || ''}</option>)}</select>}</Field>
      <Field label={t.quantity} error={!qtyValid && watch('quantity') !== undefined ? t.quantityInvalid : undefined}><input type="number" step="1" min="1" {...register('quantity', { required: true, valueAsNumber: true })} className={inputCls} /></Field>
      <Field label={t.date}><input type="date" {...register('entryDate')} className={inputCls} /></Field>
      <Field label={t.message}><input type="text" {...register('notes')} className={inputCls} /></Field>
      <div className="sm:col-span-2"><p className="text-sm font-semibold text-slate-800">{total != null ? `${t.totalCharge}: ${formatBDT(total)}` : t.quantityInvalid}</p></div>
      <div className="sm:col-span-2"><button disabled={isSubmitting || !qtyValid} className={btnPrimary}>{t.save}</button></div>
    </form></Card>}
    {q.loading ? <Skeleton className="h-40" /> : q.error ? <ErrorState error={q.error} onRetry={q.refresh} /> :
    <DataTable columns={[{ key: 'date', label: t.date, render: r => formatDate(r.entryDate || r.createdAt) }, { key: 'member', label: t.memberId, render: r => r.member ? `${r.member.memberId} — ${r.member.fullName || r.member.businessName || ''}` : '—' }, { key: 'quantity', label: t.quantity, render: r => r.quantity ?? '—' }, { key: 'feePerVehicle', label: t.feePerVehicle, render: r => formatBDT(r.feePerVehicle ?? 0) }, { key: 'total', label: t.totalCharge, render: r => formatBDT(r.totalCharge ?? r.feeAmount ?? 0) }, { key: 'status', label: t.status }, { key: 'actions', label: t.actions, render: r => <ReverseButton onReverse={() => reverse(r)} /> }]} rows={q.items} />}
    <Pagination page={q.page} totalPages={q.totalPages} t={t} onChange={p => q.setParams(s => ({ ...s, page: p }))} />
  </div>
}
export function Weighbridge() {
  const { t } = useApp()
  return <CrudList title={t.weighbridge} listPath="/v1/weighbridge" createPath="/v1/weighbridge" reversePath={r => `/v1/weighbridge/${r.id}/reverse`} createLabel={t.newEntry} feeNote={t.feeNote}
    formFields={[{ name: 'memberId', label: t.memberId, required: true }, { name: 'vehicleNo', label: t.vehicleNo, required: true }, { name: 'category', label: 'Category', type: 'select', options: [{ value: 'Bhutan', label: 'Bhutan — ৳100' }, { value: 'Bangladeshi', label: 'Bangladeshi — ৳200' }, { value: 'Lorry-crab', label: 'Lorry-crab — ৳100' }, { value: 'Trolley', label: 'Trolley — ৳300' }] }]}
    columns={[{ key: 'date', label: t.date, render: r => formatDate(r.date || r.createdAt) }, { key: 'memberId', label: t.memberId }, { key: 'vehicleNo', label: t.vehicleNo }, { key: 'category', label: 'Category' }, { key: 'fee', label: t.amount, render: r => formatBDT(r.fee ?? r.amount ?? 0) }, { key: 'status', label: t.status }]} />
}
export function Payments() {
  const { t } = useApp(); const { lang } = useParams()
  return <CrudList title={t.payments} listPath="/v1/payments" createPath="/v1/payments" reversePath={r => `/v1/payments/${r.id}/reverse`} createLabel={t.newPayment}
    formFields={[{ name: 'memberId', label: t.memberId, required: true }, { name: 'amount', label: t.amount, type: 'number', required: true }, { name: 'method', label: 'Method', type: 'select', options: [{ value: 'cash', label: 'Cash' }, { value: 'bank', label: 'Bank' }, { value: 'mobile', label: 'Mobile banking' }] }, { name: 'note', label: t.message }]}
    columns={[{ key: 'date', label: t.date, render: r => formatDate(r.date || r.createdAt) }, { key: 'memberId', label: t.memberId }, { key: 'amount', label: t.amount, render: r => formatBDT(r.amount ?? 0) }, { key: 'method', label: 'Method' }, { key: 'status', label: t.status }, { key: 'receipt', label: t.receipt, render: r => <Link to={`/${lang}/admin/payments/${r.id}/receipt`} className="font-semibold text-teal-700">{t.receipt}</Link> }]} />
}
export function ReceiptPage() {
  const { t } = useApp(); const { id } = useParams(); const q = useApi(`/v1/payments/${encodeURIComponent(id)}/receipt`)
  const r = q.data?.receipt || q.data || {}
  return <div className="mx-auto max-w-xl space-y-4"><div className="flex justify-between no-print"><h1 className="text-2xl font-bold">{t.receipt}</h1><button onClick={() => window.print()} className={btnGhost}>{t.print}</button></div>
    {q.loading ? <Skeleton className="h-64" /> : q.error ? <ErrorState error={q.error} onRetry={q.refresh} /> :
    <Card><h2 className="font-bold">{t.orgName}</h2><p className="mt-3 text-sm">{t.memberId}: {r.memberId || ''}</p><p className="text-sm">{t.amount}: <strong>{formatBDT(r.amount ?? 0)}</strong></p><p className="text-sm">{t.date}: {formatDate(r.date || r.createdAt)}</p><p className="text-sm">Method: {r.method || ''}</p><p className="text-sm">Receipt: {r.receiptNo || r.id || id}</p></Card>}
  </div>
}
export function Expenses() {
  const { t } = useApp()
  return <CrudList title={t.expenses} listPath="/v1/expenses" createPath="/v1/expenses" reversePath={null} createLabel={t.newExpense}
    formFields={[{ name: 'title', label: t.subject, required: true }, { name: 'amount', label: t.amount, type: 'number', required: true }, { name: 'category', label: 'Category' }, { name: 'note', label: t.message }]}
    columns={[{ key: 'date', label: t.date, render: r => formatDate(r.date || r.createdAt) }, { key: 'title', label: t.subject }, { key: 'amount', label: t.amount, render: r => formatBDT(r.amount ?? 0) }, { key: 'category', label: 'Category' }]} />
}
export function Fees() {
  const { t, showToast } = useApp(); const q = useApi('/v1/fee-rules'); const [showForm, setShowForm] = useState(false); const [changeRule, setChangeRule] = useState(null)
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm()
  const { register: regChange, handleSubmit: submitChange, reset: resetChange, formState: { isSubmitting: changing } } = useForm()
  const rows = Array.isArray(q.data) ? q.data : (q.data?.items || q.data?.rules || [])
  const today = new Date().toISOString().slice(0, 10)
  const save = async (v) => { try { await apiSend('post', '/v1/fee-rules', { scope: v.scope, category: v.category, amount: Math.round(Number(v.amount)), effectiveFrom: new Date(v.effectiveFrom).toISOString(), reason: v.reason || '' }); showToast(t.save); reset(); setShowForm(false); q.refresh() } catch (e) { showToast(apiErrorMessage(e, 'Save failed')) } }
  // Future-only change: close the old rule on the new effective date, then
  // create a new rule. Past entries keep their stored fee snapshots.
  const changeRate = async (v) => {
    const amount = Math.round(Number(v.amount)); const eff = new Date(v.effectiveFrom)
    if (!Number.isInteger(amount) || amount < 0 || Number.isNaN(eff.getTime())) { showToast(t.required); return }
    const effIso = eff.toISOString()
    try { await apiSend('patch', `/v1/fee-rules/${changeRule._id || changeRule.id}`, { effectiveTo: effIso }) }
    catch (e) { showToast(apiErrorMessage(e, 'Save failed')); return }
    try { await apiSend('post', '/v1/fee-rules', { scope: changeRule.scope, category: changeRule.category, amount, effectiveFrom: effIso, reason: v.reason || '' }); showToast(t.save); setChangeRule(null); q.refresh() }
    catch (e) { showToast(`${apiErrorMessage(e, 'Save failed')} — the old rule was already closed to ${v.effectiveFrom}; no new rule was created.`) }
  }
  return <div className="space-y-4"><div className="flex justify-between"><h1 className="text-3xl font-bold">{t.fees}</h1><button onClick={() => setShowForm(!showForm)} className={btnPrimary}>{t.newFee}</button></div>
    <Card><p className="text-sm text-slate-600">{t.feeNote}</p><p className="mt-2 text-sm text-slate-600">{t.feeFutureNote}</p></Card>
    {showForm && <Card><form onSubmit={handleSubmit(save)} className="grid gap-4 sm:grid-cols-2"><Field label="Scope"><select {...register('scope', { required: true })} className={inputCls}><option value="vehicle">vehicle</option><option value="weighbridge">weighbridge</option></select></Field><Field label="Category"><input {...register('category', { required: true })} className={inputCls} /></Field><Field label={t.amount}><input type="number" step="1" {...register('amount', { required: true })} className={inputCls} /></Field><Field label={t.effectiveFrom}><input type="date" defaultValue={today} {...register('effectiveFrom', { required: true })} className={inputCls} /></Field><div className="sm:col-span-2"><button disabled={isSubmitting} className={btnPrimary}>{t.save}</button></div></form></Card>}
    {changeRule && <Card><h2 className="font-bold">{t.changeRate} — {changeRule.scope}/{changeRule.category} ({formatBDT(changeRule.amount ?? 0)})</h2>
      <form onSubmit={submitChange(changeRate)} className="mt-3 grid gap-4 sm:grid-cols-3">
        <Field label={t.newAmount}><input type="number" step="1" {...regChange('amount', { required: true })} className={inputCls} /></Field>
        <Field label={t.effectiveFrom}><input type="date" defaultValue={today} {...regChange('effectiveFrom', { required: true })} className={inputCls} /></Field>
        <Field label={t.message}><input {...regChange('reason')} className={inputCls} /></Field>
        <div className="sm:col-span-3 flex gap-2"><button disabled={changing} className={btnPrimary}>{t.save}</button><button type="button" onClick={() => setChangeRule(null)} className={btnGhost}>{t.cancel}</button></div>
      </form></Card>}
    {q.loading ? <Skeleton className="h-32" /> : q.error ? <ErrorState error={q.error} onRetry={q.refresh} /> :
    <DataTable columns={[{ key: 'scope', label: 'Scope' }, { key: 'category', label: 'Category' }, { key: 'amount', label: t.amount, render: r => formatBDT(r.amount ?? 0) }, { key: 'effectiveFrom', label: t.effectiveFrom, render: r => formatDate(r.effectiveFrom) }, { key: 'effectiveTo', label: 'Effective to', render: r => r.effectiveTo ? formatDate(r.effectiveTo) : '—' }, { key: 'actions', label: t.actions, render: r => <button onClick={() => { setChangeRule(r); resetChange({ amount: r.amount, effectiveFrom: today, reason: '' }) }} className="font-semibold text-teal-700">{t.changeRate}</button> }]} rows={rows} />}
  </div>
}
