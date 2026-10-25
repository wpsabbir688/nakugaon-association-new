import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { useApp } from '../context/AppContext'

export function Skeleton({ className = 'h-6' }) {
  return <div aria-busy="true" aria-label="Loading" className={`animate-pulse rounded-lg bg-slate-200 ${className}`} />
}
export function EmptyState({ title, hint }) {
  const { t } = useApp()
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
    <p className="font-semibold text-slate-700">{title || t.noData}</p>{hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
  </div>
}
export function ErrorState({ error, onRetry }) {
  const { t } = useApp()
  return <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
    <p className="font-semibold text-red-800">{error || t.errorLoading}</p>
    {onRetry && <button onClick={onRetry} className="mt-3 rounded-full bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500">{t.retry}</button>}
  </div>
}
export function Card({ children, className = '' }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_16px_rgba(15,42,74,0.06)] ${className}`}>{children}</div>
}
export function Field({ label, error, children, htmlFor }) {
  return <div className="space-y-1">
    <label htmlFor={htmlFor} className="block text-sm font-semibold text-slate-700">{label}</label>
    {children}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
  </div>
}
export const inputCls = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/40 min-h-[44px]'
export const btnPrimary = 'rounded-full bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50 min-h-[44px]'
export const btnGhost = 'rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 min-h-[44px]'
export function Pagination({ page, totalPages, onChange, t }) {
  if (!totalPages || totalPages <= 1) return null
  return <nav aria-label="Pagination" className="mt-4 flex items-center justify-center gap-2">
    <button disabled={page <= 1} onClick={() => onChange(page - 1)} className={btnGhost}>{t.previous}</button>
    <span className="text-sm text-slate-600">{t.page} {page} / {totalPages}</span>
    <button disabled={page >= totalPages} onClick={() => onChange(page + 1)} className={btnGhost}>{t.next}</button>
  </nav>
}
// Responsive table: real table on md+, stacked cards on small screens.
export function DataTable({ columns, rows, renderCard, emptyTitle }) {
  const { t } = useApp()
  if (!rows?.length) return <EmptyState title={emptyTitle} />
  return <>
    <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-navy text-white"><tr>{columns.map(c => <th key={c.key} scope="col" className="px-4 py-3 font-semibold">{c.label}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={r.id || r._id || i} className="border-t border-slate-100 hover:bg-slate-50">{columns.map(c => <td key={c.key} className="px-4 py-3 align-top">{c.render ? c.render(r) : (r[c.key] ?? '—')}</td>)}</tr>)}</tbody>
      </table>
    </div>
    <div className="space-y-3 md:hidden">{rows.map((r, i) => <div key={r.id || r._id || i} className="rounded-2xl border border-slate-200 bg-white p-4">{renderCard ? renderCard(r) : columns.map(c => <p key={c.key} className="text-sm"><span className="font-semibold">{c.label}: </span>{c.render ? c.render(r) : (r[c.key] ?? '—')}</p>)}</div>)}</div>
  </>
}
export function ConfirmDialog({ open, title, detail, onConfirm, onCancel, busy }) {
  const { t } = useApp()
  if (!open) return null
  return <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onCancel}>
    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
      <div className="flex gap-3"><AlertTriangle className="shrink-0 text-amber-600" /><div><h2 className="font-bold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-600">{t.confirmHighImpact}</p>{detail && <p className="mt-2 rounded-xl bg-slate-100 p-3 text-sm font-medium text-slate-800">{detail}</p>}</div></div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCancel} className={btnGhost}>{t.cancel}</button>
        <button onClick={onConfirm} disabled={busy} className="rounded-full bg-red-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50">{t.confirm}</button>
      </div>
    </div>
  </div>
}
export function Toast() {
  const { toast } = useApp()
  if (!toast) return null
  return <div role="status" className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-navy px-4 py-2.5 text-sm font-medium text-white shadow-lg"><CheckCircle2 size={18} className="text-emerald-400" />{toast}</div>
}
export function LangSwitcher() {
  const { lang, t } = useApp()
  const other = lang === 'bn' ? 'en' : 'bn'
  return <Link to={`/${other}`} className="rounded-full border border-white/40 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white" aria-label={t.language}>{lang === 'bn' ? 'English' : 'বাংলা'}</Link>
}
export function useConfirm() {
  const [state, setState] = useState(null)
  const ask = (detail) => new Promise(res => setState({ detail, resolve: res }))
  const dialog = <ConfirmDialog open={!!state} title={state?.detail?.title || 'Confirm'} detail={state?.detail?.text} onCancel={() => { state.resolve(false); setState(null) }} onConfirm={() => { state.resolve(true); setState(null) }} />
  return { ask, dialog }
}
