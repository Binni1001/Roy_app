import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client'
import { useAutoDismissToast } from '../../hooks/useAutoDismissToast'
import { asArray, errorText } from '../../utils/appUtils'

export function useUserPortalData(session, setActiveTab) {
  const [periods, setPeriods] = useState([])
  const [activePerson, setActivePerson] = useState(null)
  const [selectedPeriodId, setSelectedPeriodId] = useState('')
  const [attendanceType, setAttendanceType] = useState('fixed')
  const [profileForm, setProfileForm] = useState({
    full_name: session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || '',
    phone: '',
    attendance_type: 'fixed',
  })
  const [data, setData] = useState({ debts: [], balance: null, transactions: [], sessions: [] })
  const [checkout, setCheckout] = useState(null)
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(false)

  const unpaidDebts = data.debts.filter((debt) => debt.status === 'unpaid')
  const totalDebt = unpaidDebts.reduce((sum, debt) => sum + Number(debt.amount || 0), 0)

  useAutoDismissToast(toast, setToast)

  const loadPersonData = useCallback(async (personId) => {
    try {
      const [debts, balance, transactions] = await Promise.all([
        api.debts.byPerson(personId).catch(() => []),
        api.balances.byPerson(personId).catch(() => null),
        api.balances.transactions(personId).catch(() => []),
      ])
      setData((current) => ({
        ...current,
        debts: asArray(debts),
        balance,
        transactions: asArray(transactions),
      }))
    } catch (error) {
      setToast(errorText(error))
    }
  }, [])

  const loadSessions = useCallback(async (periodId) => {
    const sessions = await api.sessions.byPeriod(periodId).catch(() => [])
    setData((current) => ({ ...current, sessions: asArray(sessions) }))
  }, [])

  const boot = useCallback(async () => {
    setLoading(true)
    try {
      const [personResult, periodsResult] = await Promise.all([
        api.people.me().catch(() => null),
        api.periods.list(),
      ])
      const nextPeriods = asArray(periodsResult)
      setActivePerson(personResult || null)
      if (personResult?.attendance_type) {
        setAttendanceType(personResult.attendance_type)
      }
      setPeriods(nextPeriods)
      setSelectedPeriodId((current) =>
        current ||
        nextPeriods.find((period) => period.status === 'open')?.id ||
        nextPeriods.find((period) => period.status === 'draft')?.id ||
        nextPeriods[0]?.id ||
        '',
      )
      setToast('Đã sẵn sàng đồng bộ dữ liệu cá nhân.')
    } catch (error) {
      setToast(errorText(error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void boot()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [boot])

  useEffect(() => {
    if (!activePerson?.id) return undefined
    const timer = window.setTimeout(() => {
      void loadPersonData(activePerson.id)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [activePerson?.id, loadPersonData])

  useEffect(() => {
    if (!selectedPeriodId) return undefined
    const timer = window.setTimeout(() => {
      void loadSessions(selectedPeriodId)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadSessions, selectedPeriodId])

  async function createPayment() {
    if (!activePerson?.id || !selectedPeriodId) {
      setToast('Tài khoản này chưa được liên kết với hồ sơ người chơi.')
      return null
    }
    setLoading(true)
    try {
      const result = await api.payments.createForPersonPeriod({
        person_id: activePerson.id,
        period_id: selectedPeriodId,
      })
      setCheckout(result)
      setActiveTab('payment')
      setToast('Đã tạo lệnh thanh toán qua PayOS.')
      await loadPersonData(activePerson.id)
      return result
    } catch (error) {
      setToast(errorText(error))
      return null
    } finally {
      setLoading(false)
    }
  }

  async function createProfile(event) {
    event.preventDefault()
    if (!profileForm.full_name.trim()) {
      setToast('Vui lòng nhập họ tên để tạo hồ sơ.')
      return
    }

    setLoading(true)
    try {
      await api.people.createMe({
        full_name: profileForm.full_name.trim(),
        phone: profileForm.phone.trim() || null,
        attendance_type: profileForm.attendance_type,
        note: profileForm.attendance_type === 'fixed'
          ? 'Người chơi đăng ký đánh cố định'
          : 'Người chơi đăng ký đánh vãng lai',
      })
      setAttendanceType(profileForm.attendance_type)
      setToast('Đã tạo hồ sơ người chơi.')
      await boot()
    } catch (error) {
      setToast(errorText(error))
    } finally {
      setLoading(false)
    }
  }

  async function updateAttendanceType(nextType) {
    if (!activePerson || nextType === attendanceType) return

    setAttendanceType(nextType)
    setLoading(true)
    try {
      const updatedPerson = await api.people.updateMe({ attendance_type: nextType })
      setActivePerson(updatedPerson)
      setToast('Đã cập nhật hình thức chơi.')
    } catch (error) {
      setAttendanceType(activePerson.attendance_type || 'fixed')
      setToast(errorText(error))
    } finally {
      setLoading(false)
    }
  }

  return {
    activePerson,
    attendanceType,
    boot,
    checkout,
    createPayment,
    createProfile,
    data,
    loading,
    periods,
    profileForm,
    selectedPeriodId,
    setProfileForm,
    setSelectedPeriodId,
    toast,
    totalDebt,
    unpaidDebts,
    updateAttendanceType,
  }
}
