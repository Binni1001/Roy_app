import { useCallback, useEffect, useMemo, useState } from 'react'
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
  const [loading, setLoading] = useState(false)
  const [checkout, setCheckout] = useState(null)

  const activePeriod = periods.find((period) => period.id === selectedPeriodId)
  const summary = useMemo(() => {
    const dashboard = data.dashboard || {}
    return [
      {
        label: 'Nợ chưa thu',
        value: formatMoney(
          readTotal(dashboard, ['total_unpaid_debt', 'unpaid_debt', 'total_debt']),
        ),
      },
      {
        label: 'Quỹ hiện tại',
        value: formatMoney(readTotal(dashboard, ['fund_balance', 'club_fund_balance'])),
      },
      { label: 'Thành viên kỳ', value: data.members.length || people.length },
      { label: 'Buổi đã ghi', value: data.sessions.length },
    ]
  }, [data.dashboard, data.members.length, data.sessions.length, people.length])

  useAutoDismissToast(toast, setToast)

  const loadPeriodData = useCallback(async (periodId) => {
    setLoading(true)
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
        api.debts.byPeriod(periodId).catch(() => []),
        api.balances.list().catch(() => []),
        api.fund.byPeriod(periodId).catch(() => []),
        api.shuttleExpenses.byPeriod(periodId).catch(() => []),
        api.shuttleSettlements.preview(periodId).catch(() => null),
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
    } finally {
      setLoading(false)
    }
  }, [])

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
    const timer = window.setTimeout(() => {
      void loadPeriodData(selectedPeriodId)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadPeriodData, selectedPeriodId])

  function setForm(name, patch) {
    setForms((current) => ({ ...current, [name]: { ...current[name], ...patch } }))
  }

  async function submit(action, successMessage) {
    setLoading(true)
    try {
      const result = await action()
      setToast(successMessage)
      await boot()
      if (selectedPeriodId) await loadPeriodData(selectedPeriodId)
      return result
    } catch (error) {
      setToast(errorText(error))
      return null
    } finally {
      setLoading(false)
    }
  }

  async function createPayment(personId = selectedPersonId) {
    if (!personId || !selectedPeriodId) {
      setToast('Cần chọn kỳ và người thanh toán.')
      return null
    }
    const result = await submit(
      () => api.payments.createForPersonPeriod({ person_id: personId, period_id: selectedPeriodId }),
      'Đã tạo lệnh thanh toán.',
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
      note: '',
    },
    fund: { transaction_type: 'income', amount: '', description: '' },
    adminUser: { email: '', full_name: '' },
  }
}
