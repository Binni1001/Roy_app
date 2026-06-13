import { useEffect } from 'react'

export function useAutoDismissToast(toast, setToast) {
  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 2000)
    return () => window.clearTimeout(timer)
  }, [toast, setToast])
}
