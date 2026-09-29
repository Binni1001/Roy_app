import { useState } from 'react'
import OpenDaysPanel from './OpenDaysPanel'
import './sessionPlanning.css'

export default function AdminSessionsLayout({ periodId, fixed, history }) {
  const [view, setView] = useState('week')
  return <div className="admin-sessions-layout">
    <nav className="sessions-sections" aria-label="Các mục Buổi cầu">
      {[['week', 'Lịch tuần'], ['fixed', 'Xếp lịch cố định'], ['history', 'Buổi đã chơi']].map(([key, label]) =>
        <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)}>{label}</button>)}
    </nav>
    {view === 'week' && <OpenDaysPanel periodId={periodId} weekly onFixed={() => setView('fixed')} />}
    {view === 'fixed' && <><p className="sessions-intro">Xếp thử trên các ngày cố định. Ngày tự đăng ký được loại trừ; đổi mục sẽ bỏ bản nháp đang xem.</p>{fixed}</>}
    {view === 'history' && history}
  </div>
}
