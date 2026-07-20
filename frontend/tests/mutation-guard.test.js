import assert from 'node:assert/strict'
import test from 'node:test'
import { createMutationCoordinator } from '../src/api/mutationGuard.js'

test('coalesces identical writes while the first request is running', async () => {
  const coordinator = createMutationCoordinator({ cooldownMs: 0 })
  let executions = 0
  let release
  let receivedConfig
  const execute = (config) => {
    executions += 1
    receivedConfig = config
    return new Promise((resolve) => { release = resolve })
  }
  const config = { url: '/api/people', method: 'POST', data: { full_name: 'Roy' } }

  const first = coordinator.run(config, execute)
  const duplicate = coordinator.run(config, execute)

  assert.equal(first, duplicate)
  assert.equal(coordinator.getPendingCount(), 1)
  await Promise.resolve()
  assert.equal(executions, 1)
  assert.match(receivedConfig.headers['Idempotency-Key'], /^[A-Za-z0-9-]{8,}$/)

  release({ id: 'one-record' })
  assert.deepEqual(await duplicate, { id: 'one-record' })
  assert.equal(coordinator.getPendingCount(), 0)
})

test('does not merge writes with different payloads', async () => {
  const coordinator = createMutationCoordinator({ cooldownMs: 0 })
  let executions = 0
  const execute = async () => {
    executions += 1
    return executions
  }

  await Promise.all([
    coordinator.run({ url: '/api/debts', method: 'POST', data: { amount: 100 } }, execute),
    coordinator.run({ url: '/api/debts', method: 'POST', data: { amount: 200 } }, execute),
  ])

  assert.equal(executions, 2)
})

test('releases a failed write so the user can retry immediately', async () => {
  const coordinator = createMutationCoordinator({ cooldownMs: 0 })
  let executions = 0
  const execute = async () => {
    executions += 1
    if (executions === 1) throw new Error('temporary failure')
    return { ok: true }
  }
  const config = { url: '/api/periods', method: 'POST', data: { name: 'Tháng 8' } }

  await assert.rejects(coordinator.run(config, execute), /temporary failure/)
  assert.deepEqual(await coordinator.run(config, execute), { ok: true })
  assert.equal(executions, 2)
})

test('leaves read requests independent and without idempotency headers', async () => {
  const coordinator = createMutationCoordinator({ cooldownMs: 0 })
  let executions = 0
  const execute = async (config) => {
    executions += 1
    assert.equal(config.headers, undefined)
  }

  await Promise.all([
    coordinator.run({ url: '/api/periods' }, execute),
    coordinator.run({ url: '/api/periods' }, execute),
  ])

  assert.equal(executions, 2)
})

test('keeps a short success cooldown while the interface updates', async () => {
  const coordinator = createMutationCoordinator({ cooldownMs: 20 })
  let executions = 0
  const execute = async () => {
    executions += 1
    return { execution: executions }
  }
  const config = { url: '/api/sessions', method: 'POST', data: { play_date: '2026-07-20' } }

  const first = await coordinator.run(config, execute)
  const immediateDuplicate = await coordinator.run(config, execute)

  assert.deepEqual(immediateDuplicate, first)
  assert.equal(executions, 1)

  await new Promise((resolve) => setTimeout(resolve, 30))
  await coordinator.run(config, execute)
  assert.equal(executions, 2)
})
