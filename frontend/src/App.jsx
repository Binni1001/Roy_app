import { useEffect, useMemo, useState } from 'react'
import { api } from './api/client'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import logoUrl from './assets/logo.png'
import './App.css'

const money = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

const emptyPerson = { full_name: '', phone: '', note: '' }
const emptyPeriod = { name: '', start_date: '', end_date: '', status: 'active' }

const adminTabs = [
  ['dashboard', 'Tổng quan', 'Bức tranh chung'],
  ['people', 'Nhân sự', 'Người trong câu lạc bộ'],
  ['periods', 'Kỳ quỹ', 'Kỳ sinh hoạt'],
  ['sessions', 'Buổi cầu', 'Lịch đã ghi nhận'],
  ['shuttle', 'Chi cầu', 'Mua và chia cầu'],
  ['debts', 'Công nợ', 'Khoản cần thu'],
  ['fund', 'Sổ quỹ', 'Thu chi câu lạc bộ'],
]

const userTabs = [
  ['home', 'Trang cá nhân'],
  ['debts', 'Công nợ'],
  ['history', 'Lịch sử'],
  ['payment', 'Thanh toán'],
]

const valueLabels = {
  paid: 'Đã thanh toán',
  unpaid: 'Chưa thanh toán',
  pending: 'Đang chờ',
  cancelled: 'Đã hủy',
  active: 'Đang hoạt động',
  closed: 'Đã chốt',
  income: 'Thu',
  expense: 'Chi',
  monthly_fee: 'Phí tháng',
  guest_fee: 'Phí khách',
  shuttle_fee: 'Phí cầu',
  other: 'Khác',
}

function asArray(value) {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  if (Array.isArray(value?.items)) return value.items
  return []
}

function readTotal(value, keys) {
  for (const key of keys) {
    if (typeof value?.[key] === 'number') return value[key]
  }
  return 0
}

function formatMoney(value) {
  return money.format(Number(value || 0))
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('vi-VN')
}

function displayValue(value) {
  return valueLabels[value] || 'Không xác định'
}

function errorText(error) {
  console.error(error)
  return 'Đã xảy ra lỗi khi xử lý dữ liệu. Vui lòng kiểm tra máy chủ hoặc mở bảng điều khiển trình duyệt để xem chi tiết.'
}

function askConfirm(message) {
  return window.confirm(message)
}

function useAutoDismissToast(toast, setToast) {
  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 2000)
    return () => window.clearTimeout(timer)
  }, [toast, setToast])
}

function getSessionRole(session) {
  return (
    session?.user?.app_metadata?.role ||
    session?.user?.user_metadata?.role ||
    'user'
  )
}

function canOpenAdmin(role) {
  return role === 'owner' || role === 'admin'
}

function RedirectTo({ to }) {
  useEffect(() => {
    window.history.replaceState({}, '', to)
  }, [to])

  return <AuthLoading />
}

function displayRole(role) {
  if (role === 'owner') return 'chủ sở hữu'
  if (role === 'admin') return 'quản trị viên'
  return 'người dùng'
}

function findPersonForSession(people, session) {
  const email = session?.user?.email?.toLowerCase()
  const userId = session?.user?.id

  return people.find((person) => {
    const personEmail = (
      person.email ||
      person.user_email ||
      person.auth_email ||
      ''
    ).toLowerCase()
    const personUserId = person.supabase_user_id || person.auth_user_id || person.user_id

    return (email && personEmail === email) || (userId && personUserId === userId)
  })
}

function App() {
  const [session, setSession] = useState(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [recoveringPassword, setRecoveringPassword] = useState(false)
  const path = window.location.pathname

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCheckingAuth(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      setCheckingAuth(false)
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveringPassword(true)
        window.history.replaceState({}, '', '/reset-password')
      }
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  if (checkingAuth) return <AuthLoading />
  if (path.startsWith('/reset-password') || recoveringPassword) return <ResetPassword />
  if (!session) return <Login />

  const role = getSessionRole(session)

  async function signOut() {
    await supabase.auth.signOut()
  }

  if (canOpenAdmin(role)) {
    if (!path.startsWith('/admin')) return <RedirectTo to="/admin" />
    return <AdminPortal session={session} role={role} onSignOut={signOut} />
  }

  if (!path.startsWith('/user')) return <RedirectTo to="/user" />
  return <UserPortal session={session} role={role} onSignOut={signOut} />
}

function AuthLoading() {
  return (
    <main className="login-page">
      <section className="login-panel">
        <BrandLogo />
        <p className="eyebrow">Roy Badminton</p>
        <h1>Đang kiểm tra đăng nhập</h1>
        <p className="muted">Vui lòng chờ trong giây lát.</p>
      </section>
    </main>
  )
}

function AdminPortal({ session, role, onSignOut }) {
  const [activeTab, setActiveTab] = useState('dashboard')
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

  useEffect(() => {
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useAutoDismissToast(toast, setToast)

  useEffect(() => {
    if (selectedPeriodId) loadPeriodData(selectedPeriodId)
  }, [selectedPeriodId])

  async function boot() {
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
        nextPeriods.find((period) => period.status === 'active')?.id ||
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
  }

  async function loadPeriodData(periodId) {
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
  }

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
      return
    }
    const result = await submit(
      () => api.payments.createForPersonPeriod({ person_id: personId, period_id: selectedPeriodId }),
      'Đã tạo lệnh thanh toán.',
    )
    if (result) setCheckout(result)
  }

  return (
    <div className="admin-shell">
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        session={session}
        role={role}
        onSignOut={onSignOut}
      />
      <main className="workspace admin-workspace">
        <Topbar
          eyebrow="Khu quản trị"
          title={activePeriod?.name || 'Chưa có kỳ'}
          loading={loading}
          onRefresh={boot}
          periodValue={selectedPeriodId}
          periods={periods}
          onPeriodChange={setSelectedPeriodId}
        />
        <StatusLine text={toast} />
        <AdminContent
          activeTab={activeTab}
          summary={summary}
          people={people}
          periods={periods}
          data={data}
          forms={forms}
          setForm={setForm}
          selectedPeriodId={selectedPeriodId}
          selectedPersonId={selectedPersonId}
          setSelectedPersonId={setSelectedPersonId}
          submit={submit}
          createPayment={createPayment}
          checkout={checkout}
          role={role}
          adminUsers={adminUsers}
        />
      </main>
    </div>
  )
}

function UserPortal({ session, role, onSignOut }) {
  const [activeTab, setActiveTab] = useState('home')
  const [periods, setPeriods] = useState([])
  const [activePerson, setActivePerson] = useState(null)
  const [selectedPeriodId, setSelectedPeriodId] = useState('')
  const [attendanceType, setAttendanceType] = useState('fixed')
  const [data, setData] = useState({ debts: [], balance: null, transactions: [], sessions: [] })
  const [checkout, setCheckout] = useState(null)
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(false)

  const unpaidDebts = data.debts.filter((debt) => debt.status !== 'paid')
  const totalDebt = unpaidDebts.reduce((sum, debt) => sum + Number(debt.amount || 0), 0)

  useEffect(() => {
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useAutoDismissToast(toast, setToast)

  useEffect(() => {
    if (activePerson?.id) loadPersonData(activePerson.id)
  }, [activePerson?.id])

  useEffect(() => {
    if (selectedPeriodId) loadSessions(selectedPeriodId)
  }, [selectedPeriodId])

  async function boot() {
    setLoading(true)
    try {
      const [peopleResult, periodsResult] = await Promise.all([
        api.people.list(),
        api.periods.list(),
      ])
      const nextPeople = asArray(peopleResult)
      const nextPeriods = asArray(periodsResult)
      setActivePerson(findPersonForSession(nextPeople, session) || null)
      setPeriods(nextPeriods)
      setSelectedPeriodId((current) =>
        current ||
        nextPeriods.find((period) => period.status === 'active')?.id ||
        nextPeriods[0]?.id ||
        '',
      )
      setToast('Đã sẵn sàng đồng bộ dữ liệu cá nhân.')
    } catch (error) {
      setToast(errorText(error))
    } finally {
      setLoading(false)
    }
  }

  async function loadPersonData(personId) {
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
  }

  async function loadSessions(periodId) {
    const sessions = await api.sessions.byPeriod(periodId).catch(() => [])
    setData((current) => ({ ...current, sessions: asArray(sessions) }))
  }

  async function createPayment() {
    if (!activePerson?.id || !selectedPeriodId) {
      setToast('Tài khoản này chưa được liên kết với hồ sơ người chơi.')
      return
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
    } catch (error) {
      setToast(errorText(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="user-shell">
      <aside className="user-sidebar">
        <BrandBlock caption="Khu người dùng" />
        <AccountBox session={session} role={role} onSignOut={onSignOut} />
        <div className="profile-card">
          <span className="avatar">{initials(activePerson?.full_name)}</span>
          <strong>{activePerson?.full_name || 'Chọn người dùng'}</strong>
          <small>{activePerson?.phone || 'Chưa có số điện thoại'}</small>
        </div>
        <nav>
          {userTabs.map(([key, label]) => (
            <button
              key={key}
              className={activeTab === key ? 'active' : ''}
              onClick={() => setActiveTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="workspace user-workspace">
        <Topbar
          eyebrow="Khu người dùng"
          title={activePerson?.full_name || 'Tài khoản cầu lông'}
          loading={loading}
          onRefresh={boot}
          periodValue={selectedPeriodId}
          periods={periods}
          onPeriodChange={setSelectedPeriodId}
        />
        <StatusLine text={toast} />
        {!activePerson && (
          <div className="toast inline-alert" role="alert">
            Tài khoản này chưa được liên kết với hồ sơ người chơi.
          </div>
        )}
        <section className="member-hero">
          <div>
            <span className="avatar large">{initials(activePerson?.full_name)}</span>
            <div className="membership-toggle">
              <button
                className={attendanceType === 'fixed' ? 'active' : ''}
                onClick={() => setAttendanceType('fixed')}
              >
                Đánh cố định
              </button>
              <button
                className={attendanceType === 'guest' ? 'active' : ''}
                onClick={() => setAttendanceType('guest')}
              >
                Đánh vãng lai
              </button>
            </div>
            <p className="eyebrow">Số dư hiện tại</p>
            <strong>{formatMoney(data.balance?.balance || 0)}</strong>
            <small>
              {attendanceType === 'fixed'
                ? 'Bạn đang xem theo diện cố định tháng này.'
                : 'Bạn đang xem theo diện vãng lai tháng này.'}
            </small>
          </div>
          <div>
            <p>Nợ cần thanh toán</p>
            <strong>{formatMoney(totalDebt)}</strong>
            <button onClick={createPayment} disabled={loading || !activePerson}>
              Thanh toán qua PayOS
            </button>
          </div>
        </section>
        <UserContent
          activeTab={activeTab}
          debts={data.debts}
          unpaidDebts={unpaidDebts}
          transactions={data.transactions}
          sessions={data.sessions}
          checkout={checkout}
        />
      </main>
    </div>
  )
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
    member: { person_id: '', monthly_fee: '' },
    session: { session_date: '', guest_count: 0, note: '' },
    guest: { session_id: '', person_id: '', amount: '' },
    shuttle: { buyer_person_id: '', quantity: 1, total_amount: '', note: '' },
    fund: { transaction_type: 'income', amount: '', description: '' },
    adminUser: { email: '', full_name: '' },
  }
}

function BrandBlock({ caption }) {
  return (
    <div className="brand">
      <BrandLogo />
      <div>
        <strong>Roy Badminton</strong>
        <small>{caption}</small>
      </div>
    </div>
  )
}

function BrandLogo() {
  return (
    <span className="brand-mark">
      <img src={logoUrl} alt="Biểu trưng Roy Badminton" />
    </span>
  )
}

function AdminSidebar({ activeTab, setActiveTab, session, role, onSignOut }) {
  return (
    <aside className="sidebar">
      <BrandBlock caption="Quản lý quỹ câu lạc bộ" />
      <AccountBox session={session} role={role} onSignOut={onSignOut} />
      <nav>
        {adminTabs.map(([key, label, hint]) => (
          <button
            key={key}
            className={activeTab === key ? 'active' : ''}
            onClick={() => setActiveTab(key)}
          >
            <span>{label}</span>
            <small>{hint}</small>
          </button>
        ))}
      </nav>
    </aside>
  )
}

function AccountBox({ session, role, onSignOut }) {
  return (
    <div className="account-box">
      <span>{session?.user?.email || 'Tài khoản Google'}</span>
      <small>Quyền: {displayRole(role)}</small>
      <button onClick={onSignOut}>Đăng xuất</button>
    </div>
  )
}

function Topbar({ eyebrow, title, loading, onRefresh, periodValue, periods, onPeriodChange, children }) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      <div className="toolbar">
        {children}
        <select value={periodValue} onChange={(event) => onPeriodChange(event.target.value)}>
          <option value="">Chọn kỳ</option>
          {periods.map((period) => (
            <option key={period.id} value={period.id}>{period.name}</option>
          ))}
        </select>
        <button onClick={onRefresh} disabled={loading}>Làm mới</button>
      </div>
    </header>
  )
}

function StatusLine({ text }) {
  if (!text) return null
  return <div className="toast" role="alert">{text}</div>
}

function AdminContent(props) {
  const {
    activeTab,
    summary,
    people,
    periods,
    data,
    forms,
    setForm,
    selectedPeriodId,
    selectedPersonId,
    setSelectedPersonId,
    submit,
    createPayment,
    checkout,
    role,
    adminUsers,
  } = props

  if (activeTab === 'dashboard') {
    return (
      <>
        <section className="metrics">
          {summary.map((item) => (
            <article className="metric" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </section>
        <section className="grid two">
          <Panel title="Công nợ gần đây"><DebtTable debts={data.debts.slice(0, 8)} /></Panel>
          <Panel title="Giao dịch quỹ"><FundTable rows={data.fund.slice(0, 8)} /></Panel>
        </section>
        {role === 'owner' && (
          <section className="grid two owner-tools">
            <Panel title="Mời quản trị viên">
              <form
                className="form"
                onSubmit={(event) => {
                  event.preventDefault()
                  submit(
                    () => api.adminUsers.invite(forms.adminUser),
                    'Đã gửi lời mời hoặc gắn quyền quản trị viên.',
                  )
                  setForm('adminUser', { email: '', full_name: '' })
                }}
              >
                <Input label="Thư điện tử quản trị viên" value={forms.adminUser.email} onChange={(value) => setForm('adminUser', { email: value })} required />
                <Input label="Tên hiển thị" value={forms.adminUser.full_name} onChange={(value) => setForm('adminUser', { full_name: value })} />
                <button>Mời làm quản trị viên</button>
              </form>
            </Panel>
            <Panel title="Danh sách quản trị viên">
              <SimpleTable
                rows={adminUsers}
                columns={[['email', 'Thư điện tử'], ['role', 'Quyền', displayRole], ['full_name', 'Tên hiển thị']]}
              />
            </Panel>
          </section>
        )}
      </>
    )
  }

  if (activeTab === 'people') {
    return (
      <section className="grid two">
        <Panel title="Thêm người">
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault()
              submit(() => api.people.create(forms.person), 'Đã thêm người mới.')
              setForm('person', emptyPerson)
            }}
          >
            <Input label="Họ tên" value={forms.person.full_name} onChange={(value) => setForm('person', { full_name: value })} required />
            <Input label="Điện thoại" value={forms.person.phone} onChange={(value) => setForm('person', { phone: value })} />
            <Input label="Ghi chú" value={forms.person.note} onChange={(value) => setForm('person', { note: value })} />
            <button>Thêm người</button>
          </form>
        </Panel>
        <Panel title="Danh sách người">
          <SimpleTable
            rows={people}
            columns={[['full_name', 'Họ tên'], ['phone', 'Điện thoại'], ['note', 'Ghi chú']]}
            actions={(person) => (
              <ActionGroup>
                <button onClick={() => editPerson(person, submit)}>Sửa</button>
                <button className="danger" onClick={() => removePerson(person, submit)}>Xóa</button>
              </ActionGroup>
            )}
          />
        </Panel>
      </section>
    )
  }

  if (activeTab === 'periods') {
    return (
      <section className="grid two">
        <Panel title="Tạo kỳ">
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault()
              submit(() => api.periods.create(forms.period), 'Đã tạo kỳ mới.')
              setForm('period', emptyPeriod)
            }}
          >
            <Input label="Tên kỳ" value={forms.period.name} onChange={(value) => setForm('period', { name: value })} required />
            <Input label="Ngày bắt đầu" type="date" value={forms.period.start_date} onChange={(value) => setForm('period', { start_date: value })} required />
            <Input label="Ngày kết thúc" type="date" value={forms.period.end_date} onChange={(value) => setForm('period', { end_date: value })} required />
            <button>Tạo kỳ</button>
          </form>
        </Panel>
        <Panel title="Thành viên trong kỳ">
          <form
            className="form compact"
            onSubmit={(event) => {
              event.preventDefault()
              submit(
                () =>
                  api.periodMembers.create({
                    period_id: selectedPeriodId,
                    person_id: forms.member.person_id,
                    monthly_fee: Number(forms.member.monthly_fee || 0),
                  }),
                'Đã thêm thành viên vào kỳ.',
              )
            }}
          >
            <SelectPeople people={people} value={forms.member.person_id} onChange={(value) => setForm('member', { person_id: value })} />
            <Input label="Phí tháng" type="number" value={forms.member.monthly_fee} onChange={(value) => setForm('member', { monthly_fee: value })} />
            <button>Thêm vào kỳ</button>
          </form>
          <SimpleTable
            rows={data.members}
            columns={[['person_name', 'Người'], ['monthly_fee', 'Phí tháng', formatMoney], ['status', 'Trạng thái', displayValue]]}
            actions={(member) => (
              <ActionGroup>
                <button onClick={() => editMember(member, submit)}>Sửa</button>
                <button className="danger" onClick={() => removeMember(member, submit)}>Xóa</button>
              </ActionGroup>
            )}
          />
        </Panel>
        <Panel title="Các kỳ" wide>
          <SimpleTable
            rows={periods}
            columns={[['name', 'Tên kỳ'], ['start_date', 'Bắt đầu', formatDate], ['end_date', 'Kết thúc', formatDate], ['status', 'Trạng thái', displayValue]]}
            actions={(period) => (
              <ActionGroup>
                <button onClick={() => editPeriod(period, submit)}>Sửa</button>
              </ActionGroup>
            )}
          />
        </Panel>
      </section>
    )
  }

  if (activeTab === 'sessions') {
    return (
      <section className="grid two">
        <Panel title="Tạo buổi cầu">
          <form className="form" onSubmit={(event) => {
            event.preventDefault()
            submit(() => api.sessions.create({ ...forms.session, period_id: selectedPeriodId, guest_count: Number(forms.session.guest_count || 0) }), 'Đã tạo buổi cầu.')
          }}>
            <Input label="Ngày chơi" type="date" value={forms.session.session_date} onChange={(value) => setForm('session', { session_date: value })} required />
            <Input label="Số khách" type="number" value={forms.session.guest_count} onChange={(value) => setForm('session', { guest_count: value })} />
            <Input label="Ghi chú" value={forms.session.note} onChange={(value) => setForm('session', { note: value })} />
            <button>Tạo buổi</button>
          </form>
        </Panel>
        <Panel title="Ghi nhận khách">
          <form className="form" onSubmit={(event) => {
            event.preventDefault()
            submit(() => api.guests.create({ ...forms.guest, amount: Number(forms.guest.amount || 0) }), 'Đã ghi nhận khách.')
          }}>
            <label>Buổi cầu<select value={forms.guest.session_id} onChange={(event) => setForm('guest', { session_id: event.target.value })}><option value="">Chọn buổi</option>{data.sessions.map((session) => <option key={session.id} value={session.id}>{formatDate(session.session_date)}</option>)}</select></label>
            <SelectPeople people={people} value={forms.guest.person_id} onChange={(value) => setForm('guest', { person_id: value })} />
            <Input label="Số tiền" type="number" value={forms.guest.amount} onChange={(value) => setForm('guest', { amount: value })} />
            <button>Ghi nhận</button>
          </form>
        </Panel>
        <Panel title="Danh sách buổi cầu" wide>
          <SimpleTable
            rows={data.sessions}
            columns={[['session_date', 'Ngày', formatDate], ['guest_count', 'Khách'], ['note', 'Ghi chú']]}
            actions={(session) => (
              <ActionGroup>
                <button onClick={() => editSession(session, submit)}>Sửa</button>
                <button className="danger" onClick={() => removeSession(session, submit)}>Xóa</button>
              </ActionGroup>
            )}
          />
        </Panel>
      </section>
    )
  }

  if (activeTab === 'shuttle') {
    return (
      <section className="grid two">
        <Panel title="Thêm chi phí cầu">
          <form className="form" onSubmit={(event) => {
            event.preventDefault()
            submit(() => api.shuttleExpenses.create({ ...forms.shuttle, period_id: selectedPeriodId, quantity: Number(forms.shuttle.quantity || 0), total_amount: Number(forms.shuttle.total_amount || 0) }), 'Đã thêm chi phí cầu.')
          }}>
            <SelectPeople people={people} value={forms.shuttle.buyer_person_id} onChange={(value) => setForm('shuttle', { buyer_person_id: value })} label="Người mua" />
            <Input label="Số hộp/quả" type="number" value={forms.shuttle.quantity} onChange={(value) => setForm('shuttle', { quantity: value })} />
            <Input label="Tổng tiền" type="number" value={forms.shuttle.total_amount} onChange={(value) => setForm('shuttle', { total_amount: value })} />
            <Input label="Ghi chú" value={forms.shuttle.note} onChange={(value) => setForm('shuttle', { note: value })} />
            <button>Thêm chi phí</button>
          </form>
        </Panel>
        <Panel title="Chốt chia cầu">
          <div className="stack">
            <p>Tiền tạm tính: {formatMoney(data.settlementPreview?.total_amount || data.settlementPreview?.total || 0)}</p>
            <button onClick={() => submit(() => api.shuttleSettlements.settle(selectedPeriodId), 'Đã chốt chia cầu.')}>Chốt chia cầu</button>
          </div>
        </Panel>
        <Panel title="Chi phí cầu" wide>
          <SimpleTable
            rows={data.shuttleExpenses}
            columns={[['buyer_name', 'Người mua'], ['quantity', 'Số lượng'], ['total_amount', 'Tổng tiền', formatMoney], ['note', 'Ghi chú']]}
            actions={(expense) => (
              <ActionGroup>
                <button onClick={() => editShuttleExpense(expense, submit)}>Sửa</button>
                <button className="danger" onClick={() => removeShuttleExpense(expense, submit)}>Xóa</button>
              </ActionGroup>
            )}
          />
        </Panel>
      </section>
    )
  }

  if (activeTab === 'debts') {
    return (
      <section className="grid two">
        <Panel title="Tạo thanh toán">
          <div className="form">
            <SelectPeople people={people} value={selectedPersonId} onChange={setSelectedPersonId} />
            <button onClick={() => createPayment(selectedPersonId)}>Tạo thanh toán PayOS</button>
            <CheckoutBox checkout={checkout} submit={submit} />
          </div>
        </Panel>
        <Panel title="Công nợ">
          <DebtTable debts={data.debts} admin submit={submit} />
        </Panel>
      </section>
    )
  }

  return (
    <section className="grid two">
      <Panel title="Ghi thu/chi quỹ">
        <form className="form" onSubmit={(event) => {
          event.preventDefault()
          submit(() => api.fund.create({ ...forms.fund, period_id: selectedPeriodId, amount: Number(forms.fund.amount || 0) }), 'Đã ghi sổ quỹ.')
        }}>
          <label>Loại<select value={forms.fund.transaction_type} onChange={(event) => setForm('fund', { transaction_type: event.target.value })}><option value="income">Thu</option><option value="expense">Chi</option></select></label>
          <Input label="Số tiền" type="number" value={forms.fund.amount} onChange={(value) => setForm('fund', { amount: value })} />
          <Input label="Nội dung" value={forms.fund.description} onChange={(value) => setForm('fund', { description: value })} />
          <button>Ghi sổ</button>
        </form>
      </Panel>
      <Panel title="Số dư từng người">
        <SimpleTable
          rows={data.balances}
          columns={[['person_name', 'Người'], ['balance', 'Số dư', formatMoney], ['updated_at', 'Cập nhật', formatDate]]}
          actions={(balance) => (
            <ActionGroup>
              <button onClick={() => offsetBalance(balance, selectedPeriodId, submit)}>Bù trừ</button>
            </ActionGroup>
          )}
        />
      </Panel>
      <Panel title="Sổ quỹ câu lạc bộ" wide><FundTable rows={data.fund} /></Panel>
    </section>
  )
}

function UserContent({ activeTab, debts, unpaidDebts, transactions, sessions, checkout }) {
  if (activeTab === 'debts') {
    return (
      <section className="grid two">
        <Panel title="Cần thanh toán"><DebtTable debts={unpaidDebts} /></Panel>
        <Panel title="Tất cả công nợ"><DebtTable debts={debts} /></Panel>
      </section>
    )
  }
  if (activeTab === 'history') {
    return (
      <section className="grid two">
        <Panel title="Lịch sử số dư">
          <SimpleTable rows={transactions} columns={[['created_at', 'Ngày', formatDate], ['amount', 'Số tiền', formatMoney], ['description', 'Nội dung']]} />
        </Panel>
        <Panel title="Buổi cầu trong kỳ">
          <SimpleTable rows={sessions} columns={[['session_date', 'Ngày', formatDate], ['guest_count', 'Khách'], ['note', 'Ghi chú']]} />
        </Panel>
      </section>
    )
  }
  if (activeTab === 'payment') {
    return <section className="grid one"><Panel title="Lệnh thanh toán PayOS"><CheckoutBox checkout={checkout} /></Panel></section>
  }
  return (
    <section className="grid three">
      <Panel title="Công nợ gần nhất"><DebtTable debts={debts.slice(0, 5)} /></Panel>
      <Panel title="Lịch sử gần đây">
        <SimpleTable rows={transactions.slice(0, 5)} columns={[['created_at', 'Ngày', formatDate], ['amount', 'Số tiền', formatMoney], ['description', 'Nội dung']]} />
      </Panel>
      <Panel title="Lịch chơi">
        <SimpleTable rows={sessions.slice(0, 5)} columns={[['session_date', 'Ngày', formatDate], ['guest_count', 'Khách'], ['note', 'Ghi chú']]} />
      </Panel>
    </section>
  )
}

function Panel({ title, children, wide = false }) {
  return <article className={wide ? 'panel wide' : 'panel'}><h2>{title}</h2>{children}</article>
}

function Input({ label, value, onChange, type = 'text', required = false }) {
  return <label>{label}<input type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} required={required} /></label>
}

function SelectPeople({ people, value, onChange, label = 'Người' }) {
  return (
    <label>
      {label}
      <select value={value || ''} onChange={(event) => onChange(event.target.value)}>
        <option value="">Chọn người</option>
        {people.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
      </select>
    </label>
  )
}

function ActionGroup({ children }) {
  return <div className="actions">{children}</div>
}

function SimpleTable({ rows, columns, actions }) {
  if (!rows.length) return <p className="empty">Chưa có dữ liệu</p>
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map(([, label]) => <th key={label}>{label}</th>)}
            {actions && <th>Thao tác</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || index}>
              {columns.map(([key, , formatter]) => (
                <td key={key}>{formatter ? formatter(row[key]) : row[key] || '-'}</td>
              ))}
              {actions && <td>{actions(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DebtTable({ debts, admin = false, submit }) {
  return (
    <SimpleTable
      rows={debts}
      columns={[
        ['person_name', 'Người'],
        ['debt_type', 'Loại', displayValue],
        ['amount', 'Số tiền', formatMoney],
        ['status', 'Trạng thái', displayValue],
      ]}
      actions={admin ? (debt) => (
        <ActionGroup>
          <button onClick={() => submit(() => api.debts.updateStatus(debt.id, 'paid'), 'Đã đánh dấu đã thanh toán.')}>Đã thu</button>
          <button onClick={() => submit(() => api.debts.updateStatus(debt.id, 'unpaid'), 'Đã chuyển về chưa thanh toán.')}>Chưa thu</button>
        </ActionGroup>
      ) : null}
    />
  )
}

function FundTable({ rows }) {
  return (
    <SimpleTable
      rows={rows}
      columns={[
        ['created_at', 'Ngày', formatDate],
        ['transaction_type', 'Loại', displayValue],
        ['amount', 'Số tiền', formatMoney],
        ['description', 'Nội dung'],
      ]}
    />
  )
}

function CheckoutBox({ checkout, submit }) {
  if (!checkout) return <p className="empty">Chưa tạo lệnh thanh toán trong phiên này.</p>
  const url = checkout.checkout_url || checkout.checkoutUrl || checkout.payment?.checkout_url
  const paymentId = checkout.id || checkout.payment?.id
  return (
    <div className="checkout">
      <strong>Đã sẵn sàng thanh toán qua PayOS</strong>
      {url ? <a href={url} target="_blank" rel="noreferrer">{url}</a> : <code>{JSON.stringify(checkout)}</code>}
      {submit && paymentId && (
        <button className="danger" onClick={() => submit(() => api.payments.cancel(paymentId), 'Đã hủy lệnh thanh toán.')}>Hủy lệnh thanh toán</button>
      )}
    </div>
  )
}

function editPerson(person, submit) {
  const fullName = window.prompt('Họ tên', person.full_name || '')
  if (fullName === null) return
  const phone = window.prompt('Điện thoại', person.phone || '')
  if (phone === null) return
  const note = window.prompt('Ghi chú', person.note || '')
  if (note === null) return
  submit(() => api.people.update(person.id, { full_name: fullName, phone, note }), 'Đã cập nhật người.')
}

function removePerson(person, submit) {
  if (!askConfirm('Xóa người này?')) return
  submit(() => api.people.remove(person.id), 'Đã xóa người.')
}

function editPeriod(period, submit) {
  const name = window.prompt('Tên kỳ', period.name || '')
  if (name === null) return
  const startDate = window.prompt('Ngày bắt đầu', period.start_date || '')
  if (startDate === null) return
  const endDate = window.prompt('Ngày kết thúc', period.end_date || '')
  if (endDate === null) return
  const status = window.prompt('Trạng thái', period.status || 'active')
  if (status === null) return
  submit(() => api.periods.update(period.id, { name, start_date: startDate, end_date: endDate, status }), 'Đã cập nhật kỳ.')
}

function editMember(member, submit) {
  const monthlyFee = window.prompt('Phí tháng', member.monthly_fee || 0)
  if (monthlyFee === null) return
  const status = window.prompt('Trạng thái', member.status || 'active')
  if (status === null) return
  submit(() => api.periodMembers.update(member.id, { monthly_fee: Number(monthlyFee || 0), status }), 'Đã cập nhật thành viên trong kỳ.')
}

function removeMember(member, submit) {
  if (!askConfirm('Xóa thành viên khỏi kỳ này?')) return
  submit(() => api.periodMembers.remove(member.id), 'Đã xóa thành viên khỏi kỳ.')
}

function editSession(session, submit) {
  const sessionDate = window.prompt('Ngày chơi', session.session_date || '')
  if (sessionDate === null) return
  const guestCount = window.prompt('Số khách', session.guest_count || 0)
  if (guestCount === null) return
  const note = window.prompt('Ghi chú', session.note || '')
  if (note === null) return
  submit(() => api.sessions.update(session.id, { session_date: sessionDate, guest_count: Number(guestCount || 0), note }), 'Đã cập nhật buổi cầu.')
}

function removeSession(session, submit) {
  if (!askConfirm('Xóa buổi cầu này?')) return
  submit(() => api.sessions.remove(session.id), 'Đã xóa buổi cầu.')
}

function editShuttleExpense(expense, submit) {
  const quantity = window.prompt('Số lượng', expense.quantity || 0)
  if (quantity === null) return
  const totalAmount = window.prompt('Tổng tiền', expense.total_amount || 0)
  if (totalAmount === null) return
  const note = window.prompt('Ghi chú', expense.note || '')
  if (note === null) return
  submit(() => api.shuttleExpenses.update(expense.id, { quantity: Number(quantity || 0), total_amount: Number(totalAmount || 0), note }), 'Đã cập nhật chi phí cầu.')
}

function removeShuttleExpense(expense, submit) {
  if (!askConfirm('Xóa chi phí cầu này?')) return
  submit(() => api.shuttleExpenses.remove(expense.id), 'Đã xóa chi phí cầu.')
}

function offsetBalance(balance, selectedPeriodId, submit) {
  const personId = balance.person_id || balance.person?.id
  if (!personId || !selectedPeriodId) return
  if (!askConfirm('Bù trừ số dư của người này vào kỳ đang chọn?')) return
  submit(() => api.balances.offset(personId, selectedPeriodId), 'Đã bù trừ số dư.')
}

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'RB'
}

export default App
