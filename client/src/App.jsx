import { Navigate, Route, Routes, useParams, useLocation, Outlet } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { AppProvider } from './context/AppContext'
import { PublicLayout, StaffLayout, Protected } from './components/Layout'
import Home from './pages/public/Home'
import About from './pages/public/About'
import Directory from './pages/public/Directory'
import MemberProfile from './pages/public/MemberProfile'
import Notices from './pages/public/Notices'
import Contact from './pages/public/Contact'
import { Login, Forgot, Reset } from './pages/auth/Auth'
import { Dashboard, MembersPage, MemberFormPage, StatementPage } from './pages/staff/StaffPages'
import { VehicleEntries, Weighbridge, Payments, ReceiptPage, Expenses, Fees } from './pages/staff/Operations'
import { NoticesManage, Reports, SettingsPage, AuditPage, ChangePasswordPage, LeadersManage, LedgerPage, AccountsPage } from './pages/staff/AdminPages'
import { Portal, Correction } from './pages/member/Portal'

const STAFF = ['SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT', 'OPERATOR']
const ADMIN = ['SUPER_ADMIN', 'MANAGER']
function LangGate({ children }) {
  const { lang } = useParams()
  if (lang !== 'bn' && lang !== 'en') return <Navigate to="/bn" replace />
  return <AppProvider lang={lang}>{children}</AppProvider>
}
// Single /:lang branch (duplicate /:lang branches would let the public wildcard swallow staff routes).
function Shell() {
  const { pathname } = useLocation()
  const isStaff = pathname.includes('/dashboard') || pathname.includes('/admin/')
  return isStaff ? <StaffLayout /> : <PublicLayout />
}
function NotFound() { return <div className="rounded-2xl border bg-white p-8 text-center font-semibold">Page not found.</div> }
export default function App() {
  return <MotionConfig reducedMotion="user"><Routes>
    <Route path="/" element={<Navigate to="/bn" replace />} />
    <Route path="/:lang" element={<LangGate><Shell /></LangGate>}>
      <Route index element={<Home />} />
      <Route path="about" element={<About />} />
      <Route path="members" element={<Directory />} />
      <Route path="members/:memberId" element={<MemberProfile />} />
      <Route path="notices" element={<Notices />} />
      <Route path="contact" element={<Contact />} />
      <Route path="login" element={<Login />} />
      <Route path="forgot-password" element={<Forgot />} />
      <Route path="reset-password" element={<Reset />} />
      <Route path="portal" element={<Protected roles={['MEMBER', 'SUPER_ADMIN', 'MANAGER']} memberOnly><Portal /></Protected>} />
      <Route path="portal/correction" element={<Protected roles={['MEMBER', 'SUPER_ADMIN', 'MANAGER']} memberOnly><Correction /></Protected>} />
      <Route path="dashboard" element={<Protected roles={STAFF}><Dashboard /></Protected>} />
      <Route path="admin/members" element={<Protected roles={STAFF}><MembersPage /></Protected>} />
      <Route path="admin/members/new" element={<Protected roles={STAFF}><MemberFormPage /></Protected>} />
      <Route path="admin/members/:id" element={<Protected roles={STAFF}><MemberFormPage /></Protected>} />
      <Route path="admin/members/:id/statement" element={<Protected roles={STAFF}><StatementPage /></Protected>} />
      <Route path="admin/vehicle-entries" element={<Protected roles={STAFF}><VehicleEntries /></Protected>} />
      <Route path="admin/weighbridge" element={<Protected roles={STAFF}><Weighbridge /></Protected>} />
      <Route path="admin/payments" element={<Protected roles={STAFF}><Payments /></Protected>} />
      <Route path="admin/payments/:id/receipt" element={<Protected roles={STAFF}><ReceiptPage /></Protected>} />
      <Route path="admin/expenses" element={<Protected roles={STAFF}><Expenses /></Protected>} />
      <Route path="admin/fees" element={<Protected roles={ADMIN}><Fees /></Protected>} />
      <Route path="admin/notices" element={<Protected roles={STAFF}><NoticesManage /></Protected>} />
      <Route path="admin/reports" element={<Protected roles={STAFF}><Reports /></Protected>} />
      <Route path="admin/settings" element={<Protected roles={ADMIN}><SettingsPage /></Protected>} />
      <Route path="admin/change-password" element={<Protected roles={STAFF}><ChangePasswordPage /></Protected>} />
      <Route path="admin/audit" element={<Protected roles={ADMIN}><AuditPage /></Protected>} />
      <Route path="admin/leaders" element={<Protected roles={ADMIN}><LeadersManage /></Protected>} />
      <Route path="admin/ledger" element={<Protected roles={STAFF}><LedgerPage /></Protected>} />
      <Route path="admin/receipts" element={<Protected roles={STAFF}><Payments /></Protected>} />
      <Route path="admin/accounts" element={<Protected roles={STAFF}><AccountsPage /></Protected>} />
      <Route path="*" element={<NotFound />} />
    </Route>
    <Route path="*" element={<Navigate to="/bn" replace />} />
  </Routes></MotionConfig>
}
