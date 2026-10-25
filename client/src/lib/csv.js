// Formula-injection guard: prefix values starting with = + - @ (or tab/CR) with a single quote,
// and always quote fields containing comma/quote/newline. See OWASP CSV injection guidance.
export function escapeCsvValue(v) {
  if (v === null || v === undefined) return ''
  let s = String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"'
  return s
}
export function toCsv(rows, headers) {
  const lines = [headers.map(escapeCsvValue).join(',')]
  for (const r of rows) lines.push(headers.map(h => escapeCsvValue(r[h])).join(','))
  return lines.join('\r\n')
}
export function downloadCsv(filename, csv) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
