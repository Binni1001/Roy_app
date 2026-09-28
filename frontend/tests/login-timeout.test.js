import assert from 'node:assert/strict'
import test from 'node:test'
import { withTimeout } from '../src/utils/withTimeout.js'

test('an auth request that never settles stops waiting', async () => {
  await assert.rejects(
    withTimeout(new Promise(() => {}), 10, 'Timed out'),
    /Timed out/,
  )
})

test('a completed auth request keeps its result', async () => {
  assert.equal(await withTimeout(Promise.resolve('ok'), 100, 'Timed out'), 'ok')
})
