import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { apiSend, apiErrorMessage } from '../../lib/api'
import { Card, Field, inputCls, btnPrimary } from '../../components/ui'

export function Login() {
  const { t, setUser, showToast } = useApp(); const navigate = useNavigate(); const { lang } = useParams()
  const [err, setErr] = useState('')
  const schema = z.object({ identifier: z.string().min(1), password: z.string().min(1) })
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) })
  const onSubmit = async (v) => { setErr(''); try {
    const data = await apiSend('post', '/v1/auth/login', { email: v.identifier, memberId: v.identifier, password: v.password })
    const user = data?.user || data; setUser(user); showToast(t.login)
    navigate(user?.role === 'MEMBER' ? `/${lang}/portal` : `/${lang}/dashboard`)
  } catch (e) { setErr(apiErrorMessage(e, t.loginFailed)) } }
  return <div className="mx-auto max-w-md"><Card><h1 className="text-2xl font-bold">{t.login}</h1><p className="mt-1 text-sm text-slate-500">{t.loginSub}</p>
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
      <Field label={t.emailOrId} error={errors.identifier && t.required}><input autoComplete="username" {...register('identifier')} className={inputCls} /></Field>
      <Field label={t.password} error={errors.password && t.required}><input type="password" autoComplete="current-password" {...register('password')} className={inputCls} /></Field>
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      <button disabled={isSubmitting} className={`${btnPrimary} w-full`}>{t.login}</button>
    </form>
    <p className="mt-4 text-center text-sm"><Link to={`/${lang}/forgot-password`} className="font-semibold text-teal-700">{t.forgotTitle}</Link></p>
  </Card></div>
}
export function Forgot() {
  const { t } = useApp()
  // Honest screen: no reset endpoint exists in the API contract, so no email is claimed.
  return <div className="mx-auto max-w-md"><Card><h1 className="text-2xl font-bold">{t.forgotTitle}</h1><p className="mt-3 text-slate-700">{t.forgotNote}</p></Card></div>
}
export function Reset() {
  const { t } = useApp()
  return <div className="mx-auto max-w-md"><Card><h1 className="text-2xl font-bold">{t.resetTitle}</h1><p className="mt-3 text-slate-700">{t.resetNote}</p></Card></div>
}
