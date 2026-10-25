import { Link, useParams } from 'react-router-dom'
import { Truck, Scale, Wallet, Users, Bell, Phone } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useApi } from '../../lib/useApi'
import { Card, Skeleton, EmptyState, ErrorState } from '../../components/ui'

export default function Home() {
  const { lang, t } = useApp(); const { lang: l } = useParams()
  const settings = useApi('/v1/public/settings')
  const members = useApi('/v1/public/members', { limit: 6 })
  const notices = useApi('/v1/public/notices', { limit: 5 })
  const s = settings.data || {}
  const stats = s.statistics || s.stats || null
  const services = [
    { icon: Users, bn: 'সদস্য সেবা', en: 'Member services' }, { icon: Truck, bn: 'যানবাহন এন্ট্রি', en: 'Vehicle entries' },
    { icon: Scale, bn: 'ওজন সেতু', en: 'Weighbridge' }, { icon: Wallet, bn: 'পেমেন্ট ও রসিদ', en: 'Payments & receipts' },
  ]
  const memberItems = Array.isArray(members.data) ? members.data : (members.data?.items || members.data?.members || [])
  const noticeItems = Array.isArray(notices.data) ? notices.data : (notices.data?.items || notices.data?.notices || [])
  return <div className="space-y-10">
    <section className="overflow-hidden rounded-3xl bg-navy px-6 py-10 text-white sm:px-10 sm:py-14">
      <p className="text-sm font-semibold uppercase tracking-wide text-teal-300">{lang === 'bn' ? 'নাকুগাঁও, বাংলাদেশ' : 'Nakugaon, Bangladesh'}</p>
      <h1 className="mt-2 max-w-2xl text-3xl font-bold leading-tight sm:text-5xl">{t.heroTitle}</h1>
      <p className="mt-3 max-w-xl text-teal-100">{t.heroSub}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link to={`/${l}/members`} className="rounded-full bg-teal-600 px-5 py-2.5 font-semibold hover:bg-teal-500 focus:outline-none focus:ring-2 focus:ring-white">{t.navMembers}</Link>
        <Link to={`/${l}/notices`} className="rounded-full border border-white/40 px-5 py-2.5 font-semibold hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white">{t.notices}</Link>
      </div>
    </section>
    <section aria-labelledby="mission"><h2 id="mission" className="text-2xl font-bold">{t.missionTitle}</h2>
      <Card className="mt-3"><p className="text-slate-700">{s.mission || s.about || t.missionText}</p>
      {s.contactPhone && <p className="mt-3 flex items-center gap-2 text-sm"><Phone size={16} />{s.contactPhone}</p>}</Card></section>
    <section aria-labelledby="services"><h2 id="services" className="text-2xl font-bold">{t.servicesTitle}</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{services.map(sv => <Card key={sv.en}><sv.icon className="text-teal-700" /><p className="mt-2 font-semibold">{lang === 'bn' ? sv.bn : sv.en}</p></Card>)}</div></section>
    <section aria-labelledby="stats"><h2 id="stats" className="text-2xl font-bold">{t.statsTitle}</h2><p className="mt-1 text-sm text-slate-500">{t.statsNote}</p>
      {settings.loading ? <Skeleton className="mt-3 h-24" /> : settings.error ? <ErrorState error={settings.error} onRetry={settings.refresh} /> :
      stats ? <div className="mt-3 grid gap-4 sm:grid-cols-3">{Object.entries(stats).map(([k, v]) => <Card key={k}><p className="text-3xl font-bold text-navy">{v}</p><p className="text-sm text-slate-500">{k}</p></Card>)}</div> : <div className="mt-3"><EmptyState hint={t.statsNote} /></div>}
    </section>
    <section aria-labelledby="members"><div className="flex items-center justify-between"><h2 id="members" className="text-2xl font-bold">{t.directoryTitle}</h2><Link to={`/${l}/members`} className="font-semibold text-teal-700">{t.viewAll} →</Link></div>
      {members.loading ? <Skeleton className="mt-3 h-32" /> : members.error ? <ErrorState error={members.error} onRetry={members.refresh} /> :
      memberItems.length ? <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{memberItems.slice(0, 6).map(m => <Card key={m.id || m.memberId}><p className="font-bold">{m.businessName || m.ownerName || m.memberId}</p><p className="text-sm text-slate-500">{m.memberId} • {m.ownerName || ''}</p><Link to={`/${l}/members/${m.memberId}`} className="mt-2 inline-block font-semibold text-teal-700">{t.viewAll} →</Link></Card>)} </div> : <div className="mt-3"><EmptyState /></div>}
    </section>
    <section aria-labelledby="notices"><div className="flex items-center justify-between"><h2 id="notices" className="text-2xl font-bold">{t.noticesTitle}</h2><Link to={`/${l}/notices`} className="font-semibold text-teal-700">{t.viewAll} →</Link></div>
      {notices.loading ? <Skeleton className="mt-3 h-24" /> : notices.error ? <ErrorState error={notices.error} onRetry={notices.refresh} /> :
      noticeItems.length ? <div className="mt-3 space-y-3">{noticeItems.map(n => <Card key={n.id}><p className="font-semibold">{n.title}</p><p className="text-sm text-slate-500">{n.publishedAt || n.date || ''}</p></Card>)}</div> : <div className="mt-3"><EmptyState /></div>}
    </section>
  </div>
}
