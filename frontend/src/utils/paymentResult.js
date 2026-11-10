// PayOS redirects the browser to PAYOS_RETURN_URL / PAYOS_CANCEL_URL. The query string
// (code, status, cancel...) is controlled by whoever opens the URL, so it only picks the
// wording; it never marks anything as paid. The webhook is the source of truth.
export function isPaymentResultPath(pathname = '') {
  return /^\/payments\/(return|cancel)\/?$/i.test(pathname)
}

export function getPaymentResultKind(pathname = '', search = '') {
  if (/^\/payments\/cancel\/?$/i.test(pathname)) return 'cancelled'
  const params = new URLSearchParams(search)
  const status = (params.get('status') || '').toUpperCase()
  if (params.get('cancel') === 'true' || status === 'CANCELLED') return 'cancelled'
  return 'returned'
}
