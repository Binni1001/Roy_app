import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Subscribe Supabase Realtime trên bảng pk_matches.
 * Khi có kèo mới (INSERT) hoặc kèo được cập nhật (UPDATE) liên quan đến người dùng hiện tại
 * (với tư cách opponent hoặc partner), trả về danh sách thông báo chưa đọc.
 */
export function usePkNotifications(activePerson) {
  const [notifications, setNotifications] = useState([])
  const personId = activePerson?.id
  const channelRef = useRef(null)

  useEffect(() => {
    if (!personId) return

    // Cleanup subscription cũ trước khi tạo mới
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase
      .channel(`pk_notifications_${personId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pk_matches' },
        (payload) => {
          const match = payload.new
          // Chỉ thông báo nếu mình là đối thủ hoặc đồng đội (không thông báo người tạo)
          const isOpponent = match.opponent_id === personId || match.opponent_partner_id === personId
          const isPartner = match.challenger_partner_id === personId

          if (isOpponent) {
            setNotifications((prev) => [
              ...prev,
              {
                id: match.id,
                type: 'challenged',
                matchType: match.match_type,
                betItems: match.bet_items,
                at: new Date(),
              },
            ])
          } else if (isPartner) {
            setNotifications((prev) => [
              ...prev,
              {
                id: match.id,
                type: 'partnered',
                matchType: match.match_type,
                betItems: match.bet_items,
                at: new Date(),
              },
            ])
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pk_matches' },
        (payload) => {
          const match = payload.new
          const prev = payload.old

          // Thông báo khi kết quả được ghi (status → completed) và mình là người trong kèo
          const isInvolved =
            match.challenger_id === personId ||
            match.opponent_id === personId ||
            match.challenger_partner_id === personId ||
            match.opponent_partner_id === personId

          if (isInvolved && match.status === 'completed' && prev.status !== 'completed') {
            const iAmChallenger = match.challenger_id === personId || match.challenger_partner_id === personId
            const iWon = (iAmChallenger && match.winner_side === 'challenger') ||
                         (!iAmChallenger && match.winner_side === 'opponent')

            setNotifications((prev) => [
              ...prev,
              {
                id: `${match.id}_result`,
                type: iWon ? 'won' : 'lost',
                matchType: match.match_type,
                betItems: match.bet_items,
                at: new Date(),
              },
            ])
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [personId])

  function dismiss(notifId) {
    setNotifications((prev) => prev.filter((n) => n.id !== notifId))
  }

  function dismissAll() {
    setNotifications([])
  }

  return { notifications, dismiss, dismissAll }
}
