import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { Menu, X, LayoutDashboard, Users, Truck, Scale, Wallet, Receipt, Settings, Bell, FileText, User } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { LangSwitcher, Toast } from './ui'

function L(lang, path) { return `/${lang}${path}` }
export function PublicLayout() {
  const { lang, t, user, logout } = useApp()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const links = [[L(lang, '/'), t.navHome], [L(lang, '/about'), t.navAbout], [L(lang, '/members'), t.navMembers], [L(lang, '/notices'), t.navNotices], [L(lang, '/contact'), t.navContact]]
  return <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
    <header className="bg-navy text-white shadow">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <Link to={L(lang, '/')} className="flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-white rounded-lg">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-600 text-xl font-bold">ন</span>
          <span className="leading-tight"><span className="block text-sm font-bold sm:text-base">{t.orgName}</span><span className="block text-xs text-teal-200">{lang === 'bn' ? 'Nakugaon Import & Export Owners Association' : 'নাকুগাঁও আমদানি ও রপ্তানিকারক মালিক সমিতি'}</span></span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {links.map(([to, label]) => <NavLink key={to} to={to} end={to === L(lang, '/')} className={({ isActive }) => `rounded-full px-3 py-2 text-sm font-medium hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white ${isActive ? 'bg-white/15' : ''}`}>{label}</NavLink>)}
          {user && <NavLink to={L(lang, user.role === 'MEMBER' ? '/portal' : '/dashboard')} className="rounded-full bg-teal-600 px-3 py-2 text-sm font-semibold hover:bg-teal-500">{user.role === 'MEMBER' ? t.navPortal : t.navDashboard}</NavLink>}
          {user ? <button onClick={async () => { await logout(); navigate(L(lang, '/')) }} className="rounded-full px-3 py-2 text-sm font-medium hover:bg-white/10">{t.navLogout}</button>
            : <NavLink to={L(lang, '/login')} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-teal-100">{t.navLogin}</NavLink>}
          <LangSwitcher />
        </nav>
        <div className="flex items-center gap-2 lg:hidden"><LangSwitcher /><button aria-label="Menu" onClick={() => setOpen(!open)} className="rounded-lg p-2 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white">{open ? <X /> : <Menu />}</button></div>
      </div>
      {open && <nav aria-label="Mobile" className="space-y-1 px-4 pb-4 lg:hidden">
        {links.map(([to, label]) => <NavLink key={to} to={to} end={to === L(lang, '/')} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 font-medium hover:bg-white/10">{label}</NavLink>)}
        {user ? <><NavLink to={L(lang, user.role === 'MEMBER' ? '/portal' : '/dashboard')} onClick={() => setOpen(false)} className="block rounded-lg bg-teal-600 px-3 py-2.5 font-semibold">{user.role === 'MEMBER' ? t.navPortal : t.navDashboard}</NavLink><button onClick={async () => { await logout(); setOpen(false); navigate(L(lang, '/')) }} className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-white/10">{t.navLogout}</button></>
          : <NavLink to={L(lang, '/login')} onClick={() => setOpen(false)} className="block rounded-lg bg-white px-3 py-2.5 font-semibold text-navy">{t.navLogin}</NavLink>}
      </nav>}
    </header>
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:py-8"><Outlet /></main>
    <footer className="bg-navy text-white"><div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-sm sm:flex-row sm:justify-between"><p className="font-semibold">{t.orgName}</p><p className="text-teal-200">{t.footerNote}</p></div></footer>
    <Toast />
  </div>
}
export function StaffLayout() {
  const { lang, t, user, logout } = useApp()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const items = [
    ['/dashboard', t.dashboard, LayoutDashboard], ['/admin/members', t.members, Users], ['/admin/vehicle-entries', t.vehicleEntries, Truck],
    ['/admin/weighbridge', t.weighbridge, Scale], ['/admin/payments', t.payments, Wallet], ['/admin/expenses', t.expenses, Receipt],
    ['/admin/fees', t.fees, Settings], ['/admin/notices', t.noticesManage, Bell], ['/admin/reports', t.reports, FileText],
    ['/admin/settings', t.settings, Settings], ['/admin/audit', t.auditLog, FileText],
  ]
  const sidebar = <nav aria-label="Staff" className="space-y-1">
    {items.map(([p, label, Icon]) => <NavLink key={p} to={L(lang, p)} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 ${isActive ? 'bg-teal-50 text-teal-800 ring-1 ring-teal-200' : 'text-slate-700'}`}><Icon size={18} />{label}</NavLink>)}
    <button onClick={async () => { await logout(); navigate(L(lang, '/')) }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">{t.navLogout}</button>
  </nav>
  return <div className="flex min-h-screen flex-col bg-slate-50">
    <header className="bg-navy text-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
      <Link to={L(lang, '/dashboard')} className="font-bold">{t.orgShort} — {t.dashboard}</Link>
      <div className="flex items-center gap-2"><span className="hidden text-sm text-teal-200 sm:block">{user?.name || user?.email || ''} ({user?.role || ''})</span><LangSwitcher /><button aria-label="Menu" onClick={() => setOpen(!open)} className="rounded-lg p-2 hover:bg-white/10 lg:hidden">{open ? <X /> : <Menu />}</button></div>
    </div></header>
    <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6">
      <aside className="hidden w-64 shrink-0 lg:block"><div className="sticky top-4 rounded-2xl border border-slate-200 bg-white p-3">{sidebar}</div></aside>
      {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)}><div className="w-72 max-w-[85vw] bg-white p-4" onClick={e => e.stopPropagation()}>{sidebar}</div></div>}
      <main className="min-w-0 flex-1"><Outlet /></main>
    </div>
    <Toast />
  </div>
}
export function Protected({ roles, children, memberOnly = false }) {
  const { t, user, authLoading } = useApp()
  const { lang } = useParams()
  if (authLoading) return <div className="space-y-3"><div className="h-8 animate-pulse rounded bg-slate-200" /><div className="h-40 animate-pulse rounded bg-slate-200" /></div>
  if (!user) return <div className="rounded-2xl border bg-white p-8 text-center"><p className="font-semibold">{t.adminOnly}</p><Link to={`/${lang}/login`} className="mt-3 inline-block rounded-full bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white">{t.login}</Link></div>
  if (roles && !roles.includes(user.role)) return <div className="rounded-2xl border bg-white p-8 text-center"><p className="font-semibold">{memberOnly ? t.memberOnly : t.adminOnly}</p></div>
  return children
}
export { User }
