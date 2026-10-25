import axios from 'axios'
const baseURL = import.meta.env.VITE_API_URL ? `${String(import.meta.env.VITE_API_URL).replace(/\/$/,'')}/api` : '/api'
export const api = axios.create({ baseURL, withCredentials: true, timeout: 30000 })
export async function apiGet(path, params) {
  const res = await api.get(path, { params })
  return res.data?.data ?? res.data
}
export async function apiSend(method, path, body) {
  const res = await api[method](path, body)
  return res.data?.data ?? res.data
}
export function apiErrorMessage(err, fallback) {
  if (err?.response?.data?.error?.message) return err.response.data.error.message
  if (err?.response?.status === 429) return fallback + ' (rate limited — please try again later)'
  if (err?.code === 'ECONNABORTED') return 'Request timed out. Please try again.'
  if (!err?.response) return 'Could not reach the server. Please check your connection and try again.'
  return fallback
}
