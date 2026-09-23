import { Suspense, lazy } from 'react'
import { isActivityPerson } from '../../utils/activityEligibility'
import { Panel, SkeletonTable } from '../../components/common'
import { GROUPS_ENABLED } from '../../config/features'

const DashboardPanel  = lazy(() => import('./panels/DashboardPanel'))
const AnalyticsPanel  = lazy(() => import('./panels/AnalyticsPanel'))
const PkPanel         = lazy(() => import('./panels/PkPanel'))
const DebtsPanel      = lazy(() => import('./panels/DebtsPanel'))
const FundPanel       = lazy(() => import('./panels/FundPanel'))
const PeoplePanel     = lazy(() => import('./panels/PeoplePanel'))
const PeriodsPanel    = lazy(() => import('./panels/PeriodsPanel'))
const SessionsPanel   = lazy(() => import('./panels/SessionsPanel'))
const ShuttlePanel    = lazy(() => import('./panels/ShuttlePanel'))
const MembersPanel    = lazy(() => import('./panels/MembersPanel'))
const TournamentPanel = lazy(() => import('./panels/TournamentPanel'))
const SessionPlanningPanel = lazy(() => import('../session-planning/SessionPlanningPanel'))

function PanelSuspense({ children }) {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}><SkeletonTable rows={5} cols={4} /></div>}>
      {children}
    </Suspense>
  )
}

export function AdminContent(props) {
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
    submitting,
    createPayment,
    checkout,
    role,
    adminUsers,
  } = props

  const submitGlobal = (action, msg) => submit(action, msg, 'global')

  if (role === 'admin' && !['people', 'periods', 'sessions'].includes(activeTab)) {
    return <Panel title="Phạm vi quản trị theo nhóm">
      <p>Bạn có thể quản lý Nhân sự, thông tin Kỳ quỹ, tạo/sửa Buổi cầu và xem thành viên/khách của các nhóm được owner phân công.</p>
      <p>Các chức năng còn lại đang chờ hoàn tất kiểm tra cách ly dữ liệu nhóm. Owner vẫn có thể thao tác; đây không phải thông báo quỹ hoặc công nợ bằng 0.</p>
    </Panel>
  }

  if (data.periodError && !['people', 'members'].includes(activeTab)) {
    return <Panel title="Không thể tải dữ liệu kỳ"><p role="alert">{data.periodError}</p><button onClick={data.retryPeriod}>Thử lại</button></Panel>
  }
  if (!['people', 'members'].includes(activeTab) && selectedPeriodId &&
    (data.periodLoading || data.loadedPeriodId !== selectedPeriodId)) return <SkeletonTable rows={5} cols={4} />

  if (activeTab === 'dashboard') {
    return (
      <PanelSuspense>
        <DashboardPanel
          summary={summary}
          debts={data.debts}
          fund={data.fund}
          members={data.members}
          sessions={data.sessions}
          shuttleExpenses={data.shuttleExpenses}
          role={role}
          adminUsers={adminUsers}
          adminUserForm={forms.adminUser}
          setForm={setForm}
          submit={submitGlobal}
        />
      </PanelSuspense>
    )
  }

  if (activeTab === 'analytics') {
    return (
      <PanelSuspense>
        <AnalyticsPanel
          debts={data.debts}
          fund={data.fund}
          shuttleExpenses={data.shuttleExpenses}
          members={data.members}
          activePeriod={props.activePeriod}
        />
      </PanelSuspense>
    )
  }

  if (activeTab === 'people') {
    return (
      <PanelSuspense>
        <PeoplePanel
          groupId={props.activePeriod?.group_id}
          people={people}
          form={forms.person}
          setForm={setForm}
          submit={submitGlobal}
          role={role}
        />
      </PanelSuspense>
    )
  }

  if (activeTab === 'periods') {
    if (data.periodError) return <Panel title="Không thể tải dữ liệu kỳ"><p role="alert">{data.periodError}</p><button onClick={data.retryPeriod}>Thử lại</button></Panel>
    if (data.periodLoading || (data.loadedPeriodId !== selectedPeriodId && selectedPeriodId)) return <SkeletonTable rows={5} cols={4} />
    return (
      <PanelSuspense>
        <PeriodsPanel
          canManageMembers={role === 'owner'}
          people={people}
          periods={periods}
          members={data.members}
          periodForm={forms.period}
          selectedPeriodId={selectedPeriodId}
          setForm={setForm}
          submit={submit}
          submitting={submitting}
        />
      </PanelSuspense>
    )
  }

  if (activeTab === 'sessions') {
    if (data.periodError) return <Panel title="Không thể tải dữ liệu kỳ"><p role="alert">{data.periodError}</p><button onClick={data.retryPeriod}>Thử lại</button></Panel>
    if (data.periodLoading || (data.loadedPeriodId !== selectedPeriodId && selectedPeriodId)) return <SkeletonTable rows={5} cols={4} />
    return (
      <PanelSuspense>
        <SessionPlanningPanel key={selectedPeriodId} periodId={selectedPeriodId} />
        <SessionsPanel
          canManageGuests={role === 'owner'}
          canDeleteSessions={role === 'owner'}
          canWriteSessions={props.activePeriod?.status === 'open'}
          people={people.filter(isActivityPerson)}
          sessions={data.sessions}
          sessionForm={forms.session}
          guestForm={forms.guest}
          selectedPeriodId={selectedPeriodId}
          setForm={setForm}
          submit={submit}
        />
      </PanelSuspense>
    )
  }

  if (activeTab === 'shuttle') {
    return (
      <PanelSuspense>
        <ShuttlePanel
          people={people.filter(isActivityPerson)}
          expenses={data.shuttleExpenses}
          settlementPreview={data.settlementPreview}
          shuttleForm={forms.shuttle}
          selectedPeriodId={selectedPeriodId}
          fundBalance={(data.fund || []).reduce((s, t) => {
            const a = Number(t.amount) || 0
            if (t.transaction_type === 'income' || t.transaction_type === 'adjustment') return s + a
            if (t.transaction_type === 'expense' || t.transaction_type === 'refund') return s - a
            return s
          }, 0)}
          setForm={setForm}
          submit={submit}
        />
      </PanelSuspense>
    )
  }

  if (activeTab === 'debts') {
    return (
      <PanelSuspense>
        <DebtsPanel
          people={people}
          debts={data.debts}
          selectedPersonId={selectedPersonId}
          setSelectedPersonId={setSelectedPersonId}
          selectedPeriodId={selectedPeriodId}
          createPayment={createPayment}
          checkout={checkout}
          submit={submit}
        />
      </PanelSuspense>
    )
  }

  if (activeTab === 'pk') {
    return <PanelSuspense><PkPanel periodId={selectedPeriodId} role={role} /></PanelSuspense>
  }

  if (activeTab === 'tournaments') {
    return <PanelSuspense><TournamentPanel people={people} /></PanelSuspense>
  }

  if (activeTab === 'members' && GROUPS_ENABLED) {
    return <PanelSuspense><MembersPanel role={role} /></PanelSuspense>
  }

  return (
    <PanelSuspense>
      <FundPanel
        balances={data.balances}
        fund={data.fund}
        debts={data.debts}
        people={people}
        periods={periods}
        fundForm={forms.fund}
        selectedPeriodId={selectedPeriodId}
        setForm={setForm}
        submit={submit}
      />
    </PanelSuspense>
  )
}
