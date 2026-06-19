import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

let _notifId = 0
function mkId() { return `notif_${++_notifId}` }

export function useNotificationCenter(activePerson, { debts = [], unpaidDebts = [] } = {}) {
  const [notifications, setNotifications] = useState([])
  const channelRef = useRef(null)
  const seenDebtIdsRef = useRef(new Set())
  const personId = activePerson?.id

  /* ── Seed debt notifications on first load ── */
  useEffect(() => {
    if (!unpaidDebts.length) return
    setNotifications((prev) => {
      const existingDebtIds = new Set(prev.filter((n) => n.kind === 'debt').map((n) => n.debtId))
      const fresh = unpaidDebts
        .filter((d) => !existingDebtIds.has(d.id) && !seenDebtIdsRef.current.has(d.id))
        .map((d) => ({
          id: mkId(),
          kind: 'debt',
          debtId: d.id,
          icon: '💸',
          title: 'Bạn đang có khoản nợ chưa trả',
          body: `${d.period_name || 'Kỳ hiện tại'} · ${Number(d.amount).toLocaleString('vi-VN')}₫`,
          action: 'home',
          at: new Date(d.created_at || Date.now()),
          read: false,
        }))
      return [...prev, ...fresh]
    })
  }, [unpaidDebts])

  /* ── Supabase Realtime: pk_matches ── */
  useEffect(() => {
    if (!personId) return

    if (channelRef.current) supabase.removeChannel(channelRef.current)

    const ch = supabase
      .channel(`notif_center_${personId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pk_matches' }, (payload) => {
        const m = payload.new
        const isOpponent = m.opponent_id === personId || m.opponent_partner_id === personId
        const isPartner  = m.challenger_partner_id === personId

        if (isOpponent) {
          push({
            kind: 'pk_challenged',
            icon: '⚔️',
            title: 'Bạn bị thách đấu!',
            body: m.match_type === 'singles' ? 'Kèo đánh đơn mới' : 'Kèo đánh đôi mới',
            action: 'pk',
          })
        } else if (isPartner) {
          push({
            kind: 'pk_partnered',
            icon: '🤝',
            title: 'Bạn được mời làm đồng đội!',
            body: 'Kèo đánh đôi mới',
            action: 'pk',
          })
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pk_matches' }, (payload) => {
        const m   = payload.new
        const old = payload.old
        const isInvolved = [m.challenger_id, m.opponent_id, m.challenger_partner_id, m.opponent_partner_id].includes(personId)

        if (isInvolved && m.status === 'completed' && old.status !== 'completed') {
          const iAmChallenger = m.challenger_id === personId || m.challenger_partner_id === personId
          const iWon = (iAmChallenger && m.winner_side === 'challenger') ||
                       (!iAmChallenger && m.winner_side === 'opponent')
          push({
            kind: iWon ? 'pk_won' : 'pk_lost',
            icon: iWon ? '🏆' : '😔',
            title: iWon ? 'Bạn đã thắng kèo!' : 'Bạn đã thua kèo',
            body: m.match_type === 'singles' ? 'Kèo đánh đơn' : 'Kèo đánh đôi',
            action: 'pk',
          })
        }
      })
      /* payments table */
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'payments' }, (payload) => {
        const p   = payload.new
        const old = payload.old
        if (p.person_id !== personId) return

        if (p.status === 'PAID' && old.status !== 'PAID') {
          push({
            kind: 'payment_success',
            icon: '✅',
            title: 'Thanh toán thành công!',
            body: `Đã nhận ${Number(p.amount || 0).toLocaleString('vi-VN')}₫`,
            action: 'home',
          })
        }
      })
      /* debts table */
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'debts' }, (payload) => {
        const d = payload.new
        if (d.person_id !== personId) return
        push({
          kind: 'debt',
          debtId: d.id,
          icon: '💸',
          title: 'Bạn có khoản nợ mới',
          body: `${Number(d.amount || 0).toLocaleString('vi-VN')}₫ · ${d.description || ''}`,
          action: 'home',
        })
      })
      .subscribe()

    channelRef.current = ch
    return () => { supabase.removeChannel(ch); channelRef.current = null }
  }, [personId])

  function push(notif) {
    setNotifications((prev) => [{
      id: mkId(),
      at: new Date(),
      read: false,
      ...notif,
    }, ...prev])
  }

  function markRead(id) {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
  }

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  function dismiss(id) {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  function dismissAll() {
    setNotifications([])
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return { notifications, unreadCount, markRead, markAllRead, dismiss, dismissAll }
}
