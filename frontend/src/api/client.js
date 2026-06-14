import axios from 'axios'
import { supabase } from '../lib/supabase'

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

const http = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

http.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

async function request(config) {
  try {
    const { data } = await http.request(config)
    return data
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'Request failed'
    throw new Error(message, { cause: error })
  }
}

export const api = {
  health: () => request({ url: '/api/health' }),

  people: {
    list: () => request({ url: '/api/people' }),
    me: () => request({ url: '/api/people/me' }),
    createMe: (payload) => request({ url: '/api/people/me', method: 'POST', data: payload }),
    updateMe: (payload) => request({ url: '/api/people/me', method: 'PUT', data: payload }),
    create: (payload) => request({ url: '/api/people', method: 'POST', data: payload }),
    update: (id, payload) =>
      request({ url: `/api/people/${id}`, method: 'PUT', data: payload }),
    remove: (id) => request({ url: `/api/people/${id}`, method: 'DELETE' }),
  },

  periods: {
    list: () => request({ url: '/api/periods' }),
    create: (payload) => request({ url: '/api/periods', method: 'POST', data: payload }),
    update: (id, payload) =>
      request({ url: `/api/periods/${id}`, method: 'PUT', data: payload }),
  },

  periodMembers: {
    byPeriod: (periodId) => request({ url: `/api/period-members/period/${periodId}` }),
    create: (payload) =>
      request({ url: '/api/period-members', method: 'POST', data: payload }),
    update: (id, payload) =>
      request({ url: `/api/period-members/${id}`, method: 'PUT', data: payload }),
    remove: (id) => request({ url: `/api/period-members/${id}`, method: 'DELETE' }),
  },

  sessions: {
    list: () => request({ url: '/api/badminton-sessions' }),
    byPeriod: (periodId) =>
      request({ url: `/api/badminton-sessions/period/${periodId}` }),
    create: (payload) =>
      request({ url: '/api/badminton-sessions', method: 'POST', data: payload }),
    update: (id, payload) =>
      request({ url: `/api/badminton-sessions/${id}`, method: 'PUT', data: payload }),
    remove: (id) => request({ url: `/api/badminton-sessions/${id}`, method: 'DELETE' }),
  },

  guests: {
    bySession: (sessionId) =>
      request({ url: `/api/guest-attendances/session/${sessionId}` }),
    byPerson: (personId) =>
      request({ url: `/api/guest-attendances/person/${personId}` }),
    create: (payload) =>
      request({ url: '/api/guest-attendances', method: 'POST', data: payload }),
    update: (id, payload) =>
      request({ url: `/api/guest-attendances/${id}`, method: 'PUT', data: payload }),
    remove: (id) => request({ url: `/api/guest-attendances/${id}`, method: 'DELETE' }),
  },

  debts: {
    list: () => request({ url: '/api/debts' }),
    byPeriod: (periodId) => request({ url: `/api/debts/period/${periodId}` }),
    byPerson: (personId) => request({ url: `/api/debts/person/${personId}` }),
    create: (payload) => request({ url: '/api/debts', method: 'POST', data: payload }),
    updateStatus: (id, status) =>
      request({ url: `/api/debts/${id}/status`, method: 'PUT', data: { status } }),
  },

  balances: {
    list: () => request({ url: '/api/person-balances' }),
    byPerson: (personId) =>
      request({ url: `/api/person-balances/person/${personId}` }),
    transactions: (personId) =>
      request({ url: `/api/person-balances/person/${personId}/transactions` }),
    offset: (personId, periodId) =>
      request({
        url: `/api/balance-offsets/person/${personId}/period/${periodId}`,
        method: 'POST',
      }),
  },

  payments: {
    createForPersonPeriod: (payload) =>
      request({
        url: '/api/payments/create-for-person-period',
        method: 'POST',
        data: payload,
      }),
    cancel: (id) => request({ url: `/api/payments/${id}/cancel`, method: 'PUT' }),
  },

  shuttleExpenses: {
    list: () => request({ url: '/api/shuttle-expenses' }),
    byPeriod: (periodId) => request({ url: `/api/shuttle-expenses/period/${periodId}` }),
    create: (payload) =>
      request({ url: '/api/shuttle-expenses', method: 'POST', data: payload }),
    update: (id, payload) =>
      request({ url: `/api/shuttle-expenses/${id}`, method: 'PUT', data: payload }),
    remove: (id) => request({ url: `/api/shuttle-expenses/${id}`, method: 'DELETE' }),
  },

  shuttleSettlements: {
    preview: (periodId) =>
      request({ url: `/api/shuttle-settlements/period/${periodId}/preview` }),
    settle: (periodId) =>
      request({
        url: `/api/shuttle-settlements/period/${periodId}/settle`,
        method: 'POST',
      }),
  },

  fund: {
    list: () => request({ url: '/api/club-fund-transactions' }),
    byPeriod: (periodId) =>
      request({ url: `/api/club-fund-transactions/period/${periodId}` }),
    create: (payload) =>
      request({ url: '/api/club-fund-transactions', method: 'POST', data: payload }),
  },

  dashboard: {
    byPeriod: (periodId) => request({ url: `/api/dashboard/period/${periodId}` }),
  },

  adminUsers: {
    list: () => request({ url: '/api/admin-users' }),
    invite: (payload) =>
      request({ url: '/api/admin-users', method: 'POST', data: payload }),
    revoke: (id) => request({ url: `/api/admin-users/${id}`, method: 'DELETE' }),
  },
}

export default http
