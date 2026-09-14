import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api/client'
import { emptyPeriod, emptyPerson } from '../../constants/appConstants'
import { useAutoDismissToast } from '../../hooks/useAutoDismissToast'
import { asArray, errorText, formatMoney, readTotal } from '../../utils/appUtils'

export function useAdminPortalData(role) {
  const [people, setPeople] = useState([])
  const [periods, setPeriods] = useState([])
  const [selectedPeriodId, setSelectedPeriodId] = useState('')
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [data, setData] = useState(defaultData())
  const [forms, setForms] = useState(defaultForms())
  const [adminUsers, setAdminUsers] = useState([])
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState('success')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [checkout, setCheckout] = useState(null)
  const submitLockRef = useRef(false)

  const activePeriod = periods.find((period) => period.id === selectedPeriodId)
  const summary = useMemo(() => {
    const dashboard = data.dashboard || {}
    const totalOutstandingDebt = data.debts
      .filter((debt) => debt.status === 'unpaid')
      .reduce((sum, debt) => sum + Number(debt.amount || 0), 0)
    return [
      {
        label: 'Tổng nợ chưa thu',
        value: formatMoney(totalOutstandingDebt),
      },
      {
        label: 'Quỹ hiện tại',
        value: formatMoney(readTotal(dashboard.fund, ['balance']) || readTotal(dashboard, ['fund_balance', 'club_fund_balance'])),
      },
      { label: 'Thành viên kỳ', value: data.members.length || people.length },
      { label: 'Buổi đã ghi', value: data.sessions.length },
    ]
  }, [data.dashboard, data.debts, data.members.length, data.sessions.length, people.length])

  useAutoDismissToast(toast, setToast)

  const loadPeriodData = useCallback(async (periodId) => {
    if (role === 'admin') {
      setData(defaultData())
      return
    }
    try {
      const [
        dashboard,
        members,
        sessions,
        debts,
        balances,
        fund,
        shuttleExpenses,
        settlementPreview,
      ] = await Promise.all([
        api.dashboard.byPeriod(periodId).catch(() => null),
        api.periodMembers.byPeriod(periodId).catch(() => []),
        api.sessions.byPeriod(periodId).catch(() => []),
        api.debts.ledgerByPeriod(periodId).catch(() => []),
        api.balances.list().catch(() => []),
        api.fund.byPeriod(periodId).catch(() => []),
        api.shuttleExpenses.byPeriod(periodId).catch(() => []),
        api.shuttleSettlements.preview(periodId).catch((error) => ({ error: errorText(error) })),
      ])
      setData((current) => ({
        ...current,
        dashboard,
        members: asArray(members),
        sessions: asArray(sessions),
        debts: asArray(debts),
        balances: asArray(balances),
        fund: asArray(fund),
        shuttleExpenses: asArray(shuttleExpenses),
        settlementPreview,
      }))
    } catch (error) {
      setToast(errorText(error))
    }
  }, [role])

  const boot = useCallback(async () => {
    setLoading(true)
    try {
      const [peopleResult, periodsResult, adminUsersResult] = await Promise.all([
        api.people.list(),
        api.periods.list(),
        role === 'owner' ? api.adminUsers.list().catch(() => []) : Promise.resolve([]),
      ])
      const nextPeople = asArray(peopleResult)
      const nextPeriods = asArray(periodsResult)
      setPeople(nextPeople)
      setPeriods(nextPeriods)
      setAdminUsers(asArray(adminUsersResult))
      setSelectedPeriodId((current) =>
        current ||
        nextPeriods.find((period) => period.status === 'open')?.id ||
        nextPeriods.find((period) => period.status === 'draft')?.id ||
        nextPeriods[0]?.id ||
        '',
      )
      setSelectedPersonId((current) => current || nextPeople[0]?.id || '')
      setToast('Đã kết nối máy chủ.')
    } catch (error) {
      setToast(errorText(error))
    } finally {
      setLoading(false)
    }
  }, [role])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void boot()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [boot])

  useEffect(() => {
    if (!selectedPeriodId) return undefined
    // Debounce 120ms: tránh gọi liên tiếp khi period thay đổi nhanh
    const timer = window.setTimeout(() => {
      void loadPeriodData(selectedPeriodId)
    }, 120)
    return () => window.clearTimeout(timer)
  }, [loadPeriodData, selectedPeriodId])

  function setForm(name, patch) {
    setForms((current) => ({ ...current, [name]: { ...current[name], ...patch } }))
  }

  // scope: 'period' (mặc định) chỉ reload dữ liệu kỳ hiện tại
  //        'global' reload cả people + periods (dùng khi tạo/xóa người, kỳ)
  async function submit(action, successMessage, scope = 'period') {
    if (submitLockRef.current) return null
    submitLockRef.current = true
    setSubmitting(true)
    try {
      const result = await action()
      setToastType('success'); setToast(successMessage)
      // Refresh data in background — không block UI
      if (scope === 'global') {
        void boot()
      } else if (selectedPeriodId) {
        void loadPeriodData(selectedPeriodId)
      }
      return result
    } catch (error) {
      setToastType('error'); setToast(errorText(error))
      return null
    } finally {
      submitLockRef.current = false
      setSubmitting(false)
    }
  }

  async function createPayment(personId = selectedPersonId) {
    if (!personId || !selectedPeriodId) {
      setToast('Cần chọn kỳ và người thanh toán.')
      return null
    }
    const result = await submit(
      () => api.payments.createForPerson({ person_id: personId, period_id: selectedPeriodId }),
      'Đã tạo một lệnh thanh toán cho toàn bộ công nợ.',
    )
    if (result) setCheckout(result)
    return result
  }

  return {
    activePeriod,
    adminUsers,
    boot,
    checkout,
    createPayment,
    data,
    forms,
    loading,
    submitting,
    people,
    periods,
    selectedPeriodId,
    selectedPersonId,
    setForm,
    setSelectedPeriodId,
    setSelectedPersonId,
    submit,
    summary,
    toast,
    toastType,
  }
}

function defaultData() {
  return {
    dashboard: null,
    members: [],
    sessions: [],
    debts: [],
    balances: [],
    fund: [],
    shuttleExpenses: [],
    settlementPreview: null,
  }
}

function defaultForms() {
  return {
    person: emptyPerson,
    period: emptyPeriod,
    member: { person_id: '' },
    session: { play_date: '', shuttle_used_count: 0, note: '' },
    guest: { session_id: '', person_id: '', amount: '' },
    shuttle: {
      buyer_id: '',
      buy_type: 'tube',
      tube_count: 1,
      shuttle_per_tube: 12,
      single_count: 0,
      total_amount: '',
      buy_date: '',
      note: '',
    },
    fund: { transaction_type: 'income', amount: '', description: '' },
    adminUser: { email: '', full_name: '' },
  }
}
