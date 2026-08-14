import axios from 'axios'
import { supabase } from '../lib/supabase'
import { mutationCoordinator } from './mutationGuard'

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

async function executeRequest(config) {
  try {
    const { data } = await http.request(config)
    return data
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'Không thể gửi yêu cầu'
    throw new Error(message, { cause: error })
  }
}

function request(config) {
  return mutationCoordinator.run(config, executeRequest)
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
    updatePassword: (id, password) =>
      request({ url: `/api/people/${id}/password`, method: 'PUT', data: { password } }),
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
    createBulk: (payload) =>
      request({ url: '/api/period-members/bulk', method: 'POST', data: payload }),
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
    ledgerByPeriod: (periodId) => request({ url: `/api/debts/period/${periodId}/ledger` }),
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
    offset: (personId) =>
      request({
        url: `/api/balance-offsets/person/${personId}`,
        method: 'POST',
      }),
    offsetAll: () =>
      request({
        url: '/api/balance-offsets/all',
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
    createForPerson: (payload) =>
      request({
        url: '/api/payments/create-for-person',
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
    createWithFundSplit: (payload) =>
      request({ url: '/api/shuttle-expenses/with-fund-split', method: 'POST', data: payload }),
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
    deposit: (payload) =>
      request({ url: '/api/club-fund-transactions/deposit', method: 'POST', data: payload }),
    refund: (payload) =>
      request({ url: '/api/club-fund-transactions/refund', method: 'POST', data: payload }),
    carryOver: (payload) =>
      request({ url: '/api/club-fund-transactions/carry-over', method: 'POST', data: payload }),
    update: (id, payload) =>
      request({ url: `/api/club-fund-transactions/${id}`, method: 'PUT', data: payload }),
    remove: (id) =>
      request({ url: `/api/club-fund-transactions/${id}`, method: 'DELETE' }),
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

  pk: {
    matches: (periodId) => request({ url: '/api/pk-matches', params: periodId ? { period_id: periodId } : undefined }),
    arena: (periodId) => request({
      url: '/api/pk-matches',
      params: { period_id: periodId, include_achievements: 'true' },
    }),
    myMatches: (periodId) => request({ url: '/api/pk-matches/me', params: periodId ? { period_id: periodId } : undefined }),
    byPerson: (personId, periodId) => request({ url: `/api/pk-matches/person/${personId}`, params: periodId ? { period_id: periodId } : undefined }),
    create: (payload) => request({ url: '/api/pk-matches', method: 'POST', data: payload }),
    createBulk: (matches, periodId) => request({ url: '/api/pk-matches/bulk', method: 'POST', data: { matches, period_id: periodId } }),
    update: (id, payload) => request({ url: `/api/pk-matches/${id}`, method: 'PUT', data: payload }),
    finalize: (id, winnerSide, setScores) => request({
      url: `/api/pk-matches/${id}/finalize`,
      method: 'POST',
      data: { winner_side: winnerSide, set_scores: setScores },
    }),
    voidResult: (id, reason) => request({
      url: `/api/pk-matches/${id}/void`,
      method: 'POST',
      data: { reason },
    }),
    remove: (id) => request({ url: `/api/pk-matches/${id}`, method: 'DELETE' }),
    leaderboard: (periodId, matchType) => request({
      url: '/api/pk-matches/leaderboard',
      params: { period_id: periodId, match_type: matchType },
    }),
    people: () => request({ url: '/api/pk-matches/people' }),
  },

  groups: {
    verifyCode:     (code)              => request({ url: '/api/groups/verify-code', method: 'POST', data: { invite_code: code } }),
    mine:           ()                  => request({ url: '/api/groups/mine' }),
    create:         (name, fullName)    => request({ url: '/api/groups/create', method: 'POST', data: { name, full_name: fullName } }),
    join:           (code, fullName)    => request({ url: '/api/groups/join', method: 'POST', data: { invite_code: code, full_name: fullName } }),
    switchGroup:    (groupId)           => request({ url: `/api/groups/switch/${groupId}`, method: 'PUT' }),
    leave:          (groupId)           => request({ url: `/api/groups/${groupId}/leave`, method: 'DELETE' }),
    info:           ()                  => request({ url: '/api/groups/info' }),
    pending:        ()                  => request({ url: '/api/groups/pending' }),
    approve:        (personId)          => request({ url: `/api/groups/members/${personId}/approve`, method: 'PUT' }),
    reject:         (personId)          => request({ url: `/api/groups/members/${personId}/reject`, method: 'PUT' }),
    regenerateCode: ()                  => request({ url: '/api/groups/regenerate-code', method: 'PUT' }),
  },

  notifications: {
    list:       ()         => request({ url: '/api/notifications' }),
    create:     (payload)  => request({ url: '/api/notifications', method: 'POST', data: payload }),
    markRead:   (id)       => request({ url: `/api/notifications/${id}/read`, method: 'PUT' }),
    markAllRead: ()        => request({ url: '/api/notifications/read-all', method: 'PUT' }),
    remindDebt: (personId) => request({ url: `/api/notifications/remind-debt/${personId}`, method: 'POST' }),
    remove:     (id)       => request({ url: `/api/notifications/${id}`, method: 'DELETE' }),
    removeAll:  ()         => request({ url: '/api/notifications/all', method: 'DELETE' }),
  },
}

export default http
