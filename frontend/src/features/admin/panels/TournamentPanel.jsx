import { Edit3, GitBranch, Plus, RefreshCw, Settings2, Trash2, Upload } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../../api/client'
import { ConfirmModal, SkeletonMatchCards } from '../../../components/common'
import { TournamentView } from '../../tournaments/TournamentView'
import { TournamentFormModal } from './tournaments/TournamentFormModal'
import { TournamentScoreModal } from './tournaments/TournamentScoreModal'
import { TournamentSetupModal } from './tournaments/TournamentSetupModal'

export function TournamentPanel({ people = [] }) {
  const [tournaments, setTournaments] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [tournament, setTournament] = useState(null)
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState('success')
  const [showForm, setShowForm] = useState(false)
  const [showSetup, setShowSetup] = useState(false)
  const [scoreMatch, setScoreMatch] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmKnockout, setConfirmKnockout] = useState(false)

  const loadList = useCallback(async (preferredId) => {
    setLoading(true)
    try {
      const rows = await api.tournaments.list()
      setTournaments(rows || [])
      const nextId = preferredId || rows?.[0]?.id || ''
      setSelectedId(nextId)
      if (!nextId) setTournament(null)
    } catch (error) { setToast(error.message); setToastType('error') } finally { setLoading(false) }
  }, [])

  const loadTournament = useCallback(async (id) => {
    setLoading(true)
    try { setTournament(await api.tournaments.get(id)) }
    catch (error) { setToast(error.message); setToastType('error') }
    finally { setLoading(false) }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadList() }, [loadList])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (selectedId) void loadTournament(selectedId) }, [selectedId, loadTournament])
  useEffect(() => { if (!toast) return undefined; const timer = setTimeout(() => setToast(''), 2000); return () => clearTimeout(timer) }, [toast])

  function notify(message, type = 'success') { setToast(message); setToastType(type) }

  async function mutate(action, success, after) {
    setSaving(true)
    try {
      const result = await action()
      notify(success)
      await after?.(result)
      return result
    } catch (error) { notify(error.message, 'error'); throw error }
    finally { setSaving(false) }
  }

  async function saveTournament(form) {
    try {
      if (tournament && showForm === 'edit') {
        await mutate(() => api.tournaments.update(tournament.id, form), 'Đã cập nhật giải.', async () => { setShowForm(false); await loadList(tournament.id); await loadTournament(tournament.id) })
      } else {
        await mutate(() => api.tournaments.create(form), 'Đã tạo giải đấu.', async (created) => { setShowForm(false); await loadList(created.id); setSelectedId(created.id) })
      }
    } catch { /* toast handled */ }
  }

  async function configure(payload) {
    try { await mutate(() => api.tournaments.configure(tournament.id, payload), 'Đã dựng vòng bảng.', async () => { setShowSetup(false); setTab('groups'); await loadTournament(tournament.id); await loadList(tournament.id) }) }
    catch { /* toast handled */ }
  }

  async function publish() {
    try { await mutate(() => api.tournaments.publish(tournament.id), 'Đã công bố giải.', async () => { await loadTournament(tournament.id); await loadList(tournament.id) }) }
    catch { /* toast handled */ }
  }

  async function buildKnockout() {
    try { await mutate(() => api.tournaments.buildKnockout(tournament.id), 'Đã tạo vòng trong.', async () => { setConfirmKnockout(false); setTab('bracket'); await loadTournament(tournament.id); await loadList(tournament.id) }) }
    catch { setConfirmKnockout(false) }
  }

  async function saveMatch(payload) {
    try { await mutate(() => api.tournaments.saveMatch(tournament.id, scoreMatch.id, payload), 'Đã lưu trận đấu.', async () => { setScoreMatch(null); await loadTournament(tournament.id); await loadList(tournament.id) }) }
    catch { /* toast handled */ }
  }

  async function removeTournament() {
    try { await mutate(() => api.tournaments.remove(tournament.id), 'Đã xóa giải đấu.', async () => { setConfirmDelete(false); setSelectedId(''); setTournament(null); await loadList() }) }
    catch { setConfirmDelete(false) }
  }

  const allGroupDone = tournament?.matches.some((match) => match.stage === 'group') && tournament.matches.filter((match) => match.stage === 'group').every((match) => match.status === 'completed')

  return (
    <div className="tour-admin-page">
      {toast && <div className={`toast toast-${toastType}`} role="alert">{toast}</div>}
      <header className="tour-admin-toolbar">
        <div><span>GIẢI ĐÔI ROY BADMINTON</span><h2>Điều hành giải đấu</h2></div>
        <div className="tour-admin-toolbar-actions">
          <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} aria-label="Chọn giải"><option value="">Chọn giải đấu</option>{tournaments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <button type="button" className="icon-button" onClick={() => selectedId ? loadTournament(selectedId) : loadList(selectedId)} title="Làm mới"><RefreshCw size={17} /></button>
          <button type="button" onClick={() => setShowForm('create')}><Plus size={17} />Tạo giải</button>
        </div>
      </header>

      {loading && !tournament ? <div className="tour-loading"><SkeletonMatchCards count={3} /></div> : !tournament ? (
        <div className="tour-empty tour-empty-page"><GitBranch size={44} /><strong>Chưa có giải đấu</strong><span>Tạo giải đầu tiên, ghép đội và chia bảng để bắt đầu.</span><button type="button" onClick={() => setShowForm('create')}><Plus size={17} />Tạo giải đấu</button></div>
      ) : <>
        <div className="tour-admin-actions">
          <button type="button" onClick={() => setShowForm('edit')}><Edit3 size={16} />Sửa giải</button>
          <button type="button" onClick={() => setShowSetup(true)}><Settings2 size={16} />Đội và chia bảng</button>
          {tournament.status === 'draft' && <button type="button" onClick={publish} disabled={saving}><Upload size={16} />Công bố</button>}
          {allGroupDone && <button type="button" className="primary" onClick={() => setConfirmKnockout(true)}><GitBranch size={16} />{tournament.matches.some((match) => match.stage !== 'group') ? 'Dựng lại vòng trong' : 'Tạo vòng trong'}</button>}
          <button type="button" className="danger" onClick={() => setConfirmDelete(true)}><Trash2 size={16} />Xóa giải</button>
        </div>
        <TournamentView tournament={tournament} tab={tab} setTab={setTab} admin onEditMatch={setScoreMatch} />
      </>}

      {showForm && <TournamentFormModal initial={showForm === 'edit' ? tournament : null} onClose={() => setShowForm(false)} onSubmit={saveTournament} saving={saving} />}
      {showSetup && <TournamentSetupModal tournament={tournament} people={people} onClose={() => setShowSetup(false)} onSubmit={configure} saving={saving} />}
      {scoreMatch && <TournamentScoreModal tournament={tournament} match={scoreMatch} onClose={() => setScoreMatch(null)} onSubmit={saveMatch} saving={saving} />}
      {confirmKnockout && <ConfirmModal title="Dựng vòng loại trực tiếp" message="Hệ thống sẽ lấy hai đội đầu mỗi bảng. Nếu vòng trong đã có kết quả, các kết quả đó sẽ được dựng lại." confirmText="Dựng vòng trong" onClose={() => setConfirmKnockout(false)} onConfirm={buildKnockout} />}
      {confirmDelete && <ConfirmModal title="Xóa giải đấu" message={`Xóa toàn bộ dữ liệu của giải “${tournament.name}”? Thao tác này không ảnh hưởng Đấu trường PK.`} confirmText="Xóa giải" danger onClose={() => setConfirmDelete(false)} onConfirm={removeTournament} />}
    </div>
  )
}

export default TournamentPanel
