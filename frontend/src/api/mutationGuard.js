const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function stableSerialize(value) {
  if (value === null || value === undefined) return String(value)
  if (value instanceof Date) return JSON.stringify(value.toISOString())
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`
  if (typeof value === 'object') {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value)
}

function mutationKey(config) {
  return stableSerialize({
    method: (config.method || 'GET').toUpperCase(),
    url: config.url || '',
    params: config.params || null,
    data: config.data || null,
  })
}

function createIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

export function createMutationCoordinator({ cooldownMs = 700 } = {}) {
  const entries = new Map()
  const listeners = new Set()
  let pendingCount = 0

  function notify() {
    for (const listener of listeners) listener()
  }

  function changePending(delta) {
    pendingCount = Math.max(0, pendingCount + delta)
    notify()
  }

  function removeAfterSuccess(key, promise) {
    const remove = () => {
      if (entries.get(key)?.promise === promise) entries.delete(key)
    }
    if (cooldownMs > 0) globalThis.setTimeout(remove, cooldownMs)
    else remove()
  }

  function run(config, execute) {
    const method = (config.method || 'GET').toUpperCase()
    if (!WRITE_METHODS.has(method)) return execute(config)

    const key = mutationKey(config)
    const existing = entries.get(key)
    if (existing) return existing.promise

    const guardedConfig = {
      ...config,
      headers: {
        ...config.headers,
        'Idempotency-Key': createIdempotencyKey(),
      },
    }

    changePending(1)
    const promise = Promise.resolve().then(() => execute(guardedConfig))
    entries.set(key, { promise })

    promise.then(
      () => {
        changePending(-1)
        removeAfterSuccess(key, promise)
      },
      () => {
        changePending(-1)
        if (entries.get(key)?.promise === promise) entries.delete(key)
      },
    )

    return promise
  }

  return {
    run,
    getPendingCount: () => pendingCount,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export const mutationCoordinator = createMutationCoordinator()

export const getPendingMutationCount = mutationCoordinator.getPendingCount
export const subscribeToMutations = mutationCoordinator.subscribe
