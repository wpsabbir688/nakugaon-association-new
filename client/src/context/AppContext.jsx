import { createContext, useContext, useEffect, useState } from 'react'
import { apiGet, apiSend } from '../lib/api'
import { dictFor } from '../i18n/dictionaries'
const Ctx = createContext(null)
export function AppProvider({ lang, children }) {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const t = dictFor(lang)
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 4500) }
  useEffect(() => {
    let live = true
    apiGet('/v1/auth/me').then(d => { if (live) setUser(d?.user || d || null) }).catch(() => { if (live) setUser(null) }).finally(() => live && setAuthLoading(false))
    return () => { live = false }
  }, [])
  const logout = async () => { try { await apiSend('post', '/v1/auth/logout', {}) } catch {} setUser(null) }
  return <Ctx.Provider value={{ lang, t, user, setUser, authLoading, toast, showToast, logout }}>{children}</Ctx.Provider>
}
export function useApp() { return useContext(Ctx) }
