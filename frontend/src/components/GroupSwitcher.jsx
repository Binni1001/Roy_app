import { useEffect, useState } from 'react'
import { api } from '../api/client'

const ROLE_LABEL = { owner: 'Trưởng', admin: 'Quản lý', member: '' }

export function GroupSwitcher({ activeGroupId, onSwitched, onAddGroup }) {
  const [groups, setGroups] = useState([])
  const [switching, setSwitching] = useState(null)

  useEffect(() => {
    api.groups.mine().then(setGroups).catch(() => {})
  }, [activeGroupId])

  async function handleSwitch(groupId) {
    if (groupId === activeGroupId || switching) return
    setSwitching(groupId)
    try {
      await api.groups.switchGroup(groupId)
      onSwitched?.()
    } catch {
      // ignore
    } finally {
      setSwitching(null)
    }
  }

  const activeGroups = groups.filter(g => g.membership_status === 'active')
  const pendingGroups = groups.filter(g => g.membership_status === 'pending')
  const canAddMore = groups.length < 3

  return (
    <div className="group-switcher">
      <p className="group-switcher-label">Nhóm của tôi</p>
      <div className="group-switcher-list">
        {activeGroups.map(g => (
          <button
            key={g.id}
            className={`group-switcher-item${g.id === activeGroupId ? ' active' : ''}`}
            onClick={() => handleSwitch(g.id)}
            disabled={switching === g.id}
          >
            <span className="group-switcher-dot" />
            <span className="group-switcher-name">{g.name}</span>
            {ROLE_LABEL[g.member_role] && (
              <span className="group-switcher-role">{ROLE_LABEL[g.member_role]}</span>
            )}
          </button>
        ))}
        {pendingGroups.map(g => (
          <button key={g.id} className="group-switcher-item" disabled style={{ opacity: 0.5 }}>
            <span className="group-switcher-dot" style={{ background: 'rgba(239,231,210,0.2)' }} />
            <span className="group-switcher-name">{g.name}</span>
            <span className="group-switcher-role">Chờ duyệt</span>
          </button>
        ))}
        {canAddMore && (
          <button className="group-switcher-add" onClick={onAddGroup}>
            <span>＋</span>
            <span>Thêm nhóm</span>
          </button>
        )}
      </div>
    </div>
  )
}
