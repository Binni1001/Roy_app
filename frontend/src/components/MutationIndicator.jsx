import { useSyncExternalStore } from 'react'
import { getPendingMutationCount, subscribeToMutations } from '../api/mutationGuard'

export function MutationIndicator() {
  const pendingCount = useSyncExternalStore(
    subscribeToMutations,
    getPendingMutationCount,
    getPendingMutationCount,
  )
  if (!pendingCount) return null

  return (
    <div className="mutation-indicator" role="status" aria-live="polite">
      <span className="mutation-indicator-spinner" aria-hidden="true" />
      <span>Đang xử lý</span>
    </div>
  )
}
