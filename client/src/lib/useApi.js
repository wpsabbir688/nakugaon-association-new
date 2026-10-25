import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiErrorMessage } from './api'
export function useApi(path, params, { enabled = true } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState('')
  const key = JSON.stringify(params || {})
  const refresh = useCallback(async () => {
    if (!enabled || !path) return
    setLoading(true); setError('')
    try { setData(await apiGet(path, params)) } catch (e) { setError(apiErrorMessage(e, 'Failed to load data.')) }
    finally { setLoading(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key, enabled])
  useEffect(() => { refresh() }, [refresh])
  return { data, loading, error, refresh }
}
export function usePaginatedList(path, initialParams = {}) {
  const [params, setParams] = useState({ page: 1, limit: 20, ...initialParams })
  const { data, loading, error, refresh } = useApi(path, params)
  const items = Array.isArray(data) ? data : (data?.items || data?.members || data?.data || [])
  const total = data?.total ?? data?.pagination?.total ?? items.length
  const totalPages = data?.totalPages ?? data?.pagination?.totalPages ?? 1
  return { items, total, totalPages, page: params.page, params, setParams, loading, error, refresh, raw: data }
}
