import { RefreshCw, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { SkeletonMatchCards } from '../../components/common'
import { TournamentView } from '../tournaments/TournamentView'

export function TournamentHub() {
  const [tournaments, setTournaments] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [tournament, setTournament] = useState(null)
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  useEffect(() => { void loadList() }, [])
  useEffect(() => { if (selectedId) void loadTournament(selectedId) }, [selectedId])
  useEffect(() => { if (!toast) return undefined; const timer = setTimeout(() => setToast(''), 2000); return () => clearTimeout(timer) }, [toast])

  async function loadList() {
    setLoading(true)
    try {
      const rows = await api.tournaments.list()
      setTournaments(rows || [])
      setSelectedId((current) => current || rows?.[0]?.id || '')
      if (!rows?.length) setTournament(null)
    } catch (error) { setToast(error.message) } finally { setLoading(false) }
  }

  async function loadTournament(id) {
    setLoading(true)
    try { setTournament(await api.tournaments.get(id)) }
    catch (error) { setToast(error.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="tour-user-page">
      {toast && <div className="toast toast-error" role="alert">{toast}</div>}
      <header className="tour-user-toolbar">
        <div><span>GIẢI ĐÔI</span><h2>Đấu giải Roy Badminton</h2></div>
        <div><select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} aria-label="Chọn giải đấu"><option value="">Chọn giải đấu</option>{tournaments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button type="button" className="icon-button" onClick={() => selectedId ? loadTournament(selectedId) : loadList()} aria-label="Làm mới"><RefreshCw size={17} /></button></div>
      </header>
      {loading && !tournament ? <div className="tour-loading"><SkeletonMatchCards count={3} /></div> : tournament ? <TournamentView tournament={tournament} tab={tab} setTab={setTab} /> : <div className="tour-empty tour-empty-page"><Trophy size={44} /><strong>Chưa có giải đang công bố</strong><span>Khi admin công bố giải, vòng bảng và lịch đấu sẽ xuất hiện tại đây.</span></div>}
    </div>
  )
}

export default TournamentHub
