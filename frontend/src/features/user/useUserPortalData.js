import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../api/client'
import { supabase } from '../../lib/supabase'
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
  const [toastType, setToastType] = useState('success')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const submissionLockRef = useRef(false)

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
      setToastType('error'); setToast(errorText(error))
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
      setToastType('error'); setToast(errorText(error))
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
    }, 120)
    return () => window.clearTimeout(timer)
  }, [loadSessions, selectedPeriodId])

  async function createPayment() {
    if (!activePerson?.id) {
      setToast('Tài khoản này chưa được liên kết với hồ sơ người chơi.')
      return null
    }
    if (submissionLockRef.current) return null
    submissionLockRef.current = true
    setSubmitting(true)
    try {
      // Trả TẤT CẢ nợ chưa trả của người này (mọi kỳ) trong 1 QR
      const result = await api.payments.createForPerson({
        person_id: activePerson.id,
        period_id: selectedPeriodId,
      })
      setCheckout(result)
      void loadPersonData(activePerson.id)
      const url = result?.checkout_url || result?.checkoutUrl || result?.payment?.checkout_url
      if (url) {
        window.location.href = url
      } else {
        setActiveTab('payment')
        setToast('Đã tạo lệnh thanh toán qua PayOS.')
      }
      return result
    } catch (error) {
      setToastType('error'); setToast(errorText(error))
      return null
    } finally {
      submissionLockRef.current = false
      setSubmitting(false)
    }
  }

  async function createProfile(event) {
    event.preventDefault()
    if (!profileForm.full_name.trim()) {
      setToast('Vui lòng nhập họ tên để tạo hồ sơ.')
      return
    }

    if (submissionLockRef.current) return
    submissionLockRef.current = true
    setSubmitting(true)
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
      void boot()
    } catch (error) {
      setToastType('error'); setToast(errorText(error))
    } finally {
      submissionLockRef.current = false
      setSubmitting(false)
    }
  }

  async function updateProfile(formData, avatarFile) {
    if (submissionLockRef.current) return null
    submissionLockRef.current = true
    setSubmitting(true)
    try {
      let avatar_url = activePerson?.avatar_url || null

      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop()
        const path = `${activePerson.id}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type })
        if (uploadError) throw new Error(`Upload ảnh thất bại: ${uploadError.message}`)
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
        // Append cache-buster so new image shows immediately after re-upload
        avatar_url = `${urlData.publicUrl}?t=${Date.now()}`
      }

      const updated = await api.people.updateMe({
        full_name: formData.full_name.trim(),
        nickname: formData.nickname.trim() || null,
        phone: formData.phone.trim() || null,
        bio: formData.bio.trim() || null,
        birthday: formData.birthday || null,
        gender: formData.gender || null,
        attendance_type: formData.attendance_type,
        avatar_url,
      })
      setActivePerson(updated)
      setAttendanceType(updated.attendance_type)
      setToast('Đã cập nhật hồ sơ thành công.')
    } catch (error) {
      setToastType('error'); setToast(errorText(error))
    } finally {
      submissionLockRef.current = false
      setSubmitting(false)
    }
  }

  async function updateAttendanceType(nextType) {
    if (!activePerson || nextType === attendanceType) return
    if (submissionLockRef.current) return

    submissionLockRef.current = true
    setAttendanceType(nextType)
    setSubmitting(true)
    try {
      const updatedPerson = await api.people.updateMe({ attendance_type: nextType })
      setActivePerson(updatedPerson)
      setToast('Đã cập nhật hình thức chơi.')
    } catch (error) {
      setAttendanceType(activePerson.attendance_type || 'fixed')
      setToastType('error'); setToast(errorText(error))
    } finally {
      submissionLockRef.current = false
      setSubmitting(false)
    }
  }

  return {
    activePerson,
    attendanceType,
    boot,
    checkout,
    createPayment,
    createProfile,
    updateProfile,
    data,
    loading,
    submitting,
    periods,
    profileForm,
    selectedPeriodId,
    setProfileForm,
    setSelectedPeriodId,
    toast,
    toastType,
    totalDebt,
    unpaidDebts,
    updateAttendanceType,
  }
}
