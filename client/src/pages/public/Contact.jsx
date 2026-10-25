import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useApp } from '../../context/AppContext'
import { apiSend, apiErrorMessage } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { Card, Field, inputCls, btnPrimary } from '../../components/ui'
const schema = z.object({ name: z.string().min(1), email: z.string().email(), subject: z.string().min(1), message: z.string().min(1).max(2000) })
export default function Contact() {
  const { t, showToast } = useApp(); const [err, setErr] = useState('')
  const settings = useApi('/v1/public/settings'); const s = settings.data || {}
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) })
  const onSubmit = async (v) => { setErr(''); try { await apiSend('post', '/v1/public/contact', v); showToast(t.contactSent); reset() } catch (e) { setErr(apiErrorMessage(e, t.contactNotSent)) } }
  return <div className="mx-auto max-w-2xl space-y-5"><h1 className="text-3xl font-bold">{t.contactTitle}</h1><p className="text-slate-600">{t.contactSub}</p>
    {(s.contactPhone || s.contactEmail || s.address) && <Card><p>{s.address || ''}</p><p>{s.contactPhone || ''}</p><p>{s.contactEmail || ''}</p></Card>}
    <Card><form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Field label={t.name} error={errors.name && t.required}><input {...register('name')} className={inputCls} /></Field>
      <Field label={t.email} error={errors.email && t.required}><input type="email" {...register('email')} className={inputCls} /></Field>
      <Field label={t.subject} error={errors.subject && t.required}><input {...register('subject')} className={inputCls} /></Field>
      <Field label={t.message} error={errors.message && t.required}><textarea rows={5} {...register('message')} className={inputCls} /></Field>
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      <button disabled={isSubmitting} className={btnPrimary}>{t.submit}</button>
    </form></Card></div>
}
