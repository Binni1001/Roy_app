import { Suspense, lazy } from 'react'
import { SkeletonTable } from '../../components/common'

const DashboardPanel  = lazy(() => import('./panels/DashboardPanel'))
const AnalyticsPanel  = lazy(() => import('./panels/AnalyticsPanel'))
const PkPanel         = lazy(() => import('./panels/PkPanel'))
const DebtsPanel      = lazy(() => import('./panels/DebtsPanel'))
const FundPanel       = lazy(() => import('./panels/FundPanel'))
const PeoplePanel     = lazy(() => import('./panels/PeoplePanel'))
const PeriodsPanel    = lazy(() => import('./panels/PeriodsPanel'))
const SessionsPanel   = lazy(() => import('./panels/SessionsPanel'))
const ShuttlePanel    = lazy(() => import('./panels/ShuttlePanel'))

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
    createPayment,
    checkout,
    role,
    adminUsers,
  } = props

  const submitGlobal = (action, msg) => submit(action, msg, 'global')

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
          people={people}
          form={forms.person}
          setForm={setForm}
          submit={submitGlobal}
        />
      </PanelSuspense>
    )
  }

  if (activeTab === 'periods') {
    return (
      <PanelSuspense>
        <PeriodsPanel
          people={people}
          periods={periods}
          members={data.members}
          periodForm={forms.period}
          memberForm={forms.member}
          selectedPeriodId={selectedPeriodId}
          setForm={setForm}
          submit={submitGlobal}
        />
      </PanelSuspense>
    )
  }

  if (activeTab === 'sessions') {
    return (
      <PanelSuspense>
        <SessionsPanel
          people={people}
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
          people={people}
          expenses={data.shuttleExpenses}
          settlementPreview={data.settlementPreview}
          shuttleForm={forms.shuttle}
          selectedPeriodId={selectedPeriodId}
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
          createPayment={createPayment}
          checkout={checkout}
          submit={submit}
        />
      </PanelSuspense>
    )
  }

  if (activeTab === 'pk') {
    return <PanelSuspense><PkPanel /></PanelSuspense>
  }

  return (
    <PanelSuspense>
      <FundPanel
        balances={data.balances}
        fund={data.fund}
        debts={data.debts}
        people={people}
        fundForm={forms.fund}
        selectedPeriodId={selectedPeriodId}
        setForm={setForm}
        submit={submit}
      />
    </PanelSuspense>
  )
}
