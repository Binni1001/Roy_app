import test from 'node:test'
import assert from 'node:assert/strict'
import { getPaymentResultKind, isPaymentResultPath } from '../src/utils/paymentResult.js'

test('only the PayOS redirect paths open the payment result page', () => {
  assert.equal(isPaymentResultPath('/payments/return'), true)
  assert.equal(isPaymentResultPath('/payments/cancel/'), true)
  assert.equal(isPaymentResultPath('/payments'), false)
  assert.equal(isPaymentResultPath('/'), false)
})

test('the result page never claims success from the query string', () => {
  assert.equal(getPaymentResultKind('/payments/cancel', ''), 'cancelled')
  assert.equal(getPaymentResultKind('/payments/return', '?cancel=true&status=CANCELLED'), 'cancelled')
  assert.equal(getPaymentResultKind('/payments/return', '?code=00&status=PAID'), 'returned')
  assert.equal(getPaymentResultKind('/payments/return', ''), 'returned')
})
