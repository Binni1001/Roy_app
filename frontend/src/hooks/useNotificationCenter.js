import { useEffect, useRef, useState, useCallback } from 'react'
import { api } from '../api/client'
import { supabase } from '../lib/supabase'

export function useNotificationCenter(activePerson) {
  const [notifications, setNotifications] = useState([])
  const [loaded, setLoaded] = useState(false)
  const channelRef = useRef(null)
  const personId = activePerson?.id

  /* ── Load from DB on mount / person change ── */
  const loadAll = useCallback(async () => {
    if (!personId) return
    try {
      const data = await api.notifications.list()
      setNotifications(data || [])
    } catch (_) {}
    setLoaded(true)
  }, [personId])

  useEffect(() => { loadAll() }, [loadAll])

  /* ── Save a new notification to DB + local state ── */
  async function push(notif) {
    if (!personId) return
    try {
      const saved = await api.notifications.create(notif)
      setNotifications((prev) => [saved, ...prev])
    } catch (_) {
      // fallback: show in state even if DB fails
      setNotifications((prev) => [{
        id: `tmp_${Date.now()}`,
        created_at: new Date().toISOString(),
        read: false,
        ...notif,
      }, ...prev])
    }
  }

  /* ── Supabase Realtime: pk_matches + payments + debts ── */
  useEffect(() => {
    if (!personId) return

    if (channelRef.current) supabase.removeChannel(channelRef.current)

    const ch = supabase
      .channel(`notif_center_${personId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pk_matches' }, (payload) => {
        const m = payload.new
        const isOpponent = m.opponent_id === personId || m.opponent_partner_id === personId
        const isPartner  = m.challenger_partner_id === personId
        if (isOpponent) push({ kind: 'pk_challenged', icon: '⚔️', title: 'Bạn bị thách đấu!', body: m.match_type === 'singles' ? 'Kèo đánh đơn mới' : 'Kèo đánh đôi mới', action: 'pk' })
        else if (isPartner) push({ kind: 'pk_partnered', icon: '🤝', title: 'Bạn được mời làm đồng đội!', body: 'Kèo đánh đôi mới', action: 'pk' })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pk_matches' }, (payload) => {
        const m = payload.new
        const old = payload.old
        const isInvolved = [m.challenger_id, m.opponent_id, m.challenger_partner_id, m.opponent_partner_id].includes(personId)
        if (isInvolved && m.status === 'completed' && old.status !== 'completed') {
          const iAmChallenger = m.challenger_id === personId || m.challenger_partner_id === personId
          const iWon = (iAmChallenger && m.winner_side === 'challenger') || (!iAmChallenger && m.winner_side === 'opponent')
          push({ kind: iWon ? 'pk_won' : 'pk_lost', icon: iWon ? '🏆' : '😔', title: iWon ? 'Bạn đã thắng kèo!' : 'Bạn đã thua kèo', body: m.match_type === 'singles' ? 'Kèo đánh đơn' : 'Kèo đánh đôi', action: 'pk' })
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'payments' }, (payload) => {
        const p = payload.new
        const old = payload.old
        if (p.person_id !== personId) return
        if (p.status === 'PAID' && old.status !== 'PAID') {
          push({ kind: 'payment_success', icon: '✅', title: 'Thanh toán thành công!', body: `Đã nhận ${Number(p.amount || 0).toLocaleString('vi-VN')}₫`, action: 'home' })
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'debts' }, (payload) => {
        const d = payload.new
        if (d.person_id !== personId) return
        push({ kind: 'debt_new', icon: '💸', title: 'Bạn có khoản nợ mới', body: `${Number(d.amount || 0).toLocaleString('vi-VN')}₫`, action: 'home' })
      })
      .subscribe()

    channelRef.current = ch
    return () => { supabase.removeChannel(ch); channelRef.current = null }
  }, [personId])

  /* ── Actions ── */
  async function markRead(id) {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
    try { await api.notifications.markRead(id) } catch (_) {}
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    try { await api.notifications.markAllRead() } catch (_) {}
  }

  async function dismiss(id) {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    try { await api.notifications.remove(id) } catch (_) {}
  }

  async function dismissAll() {
    setNotifications([])
    try { await api.notifications.removeAll() } catch (_) {}
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return { notifications, unreadCount, loaded, markRead, markAllRead, dismiss, dismissAll }
}
