import { DashboardPanel } from './panels/DashboardPanel'
import { AnalyticsPanel } from './panels/AnalyticsPanel'
import { PkPanel } from './panels/PkPanel'
import { DebtsPanel } from './panels/DebtsPanel'
import { FundPanel } from './panels/FundPanel'
import { PeoplePanel } from './panels/PeoplePanel'
import { PeriodsPanel } from './panels/PeriodsPanel'
import { SessionsPanel } from './panels/SessionsPanel'
import { ShuttlePanel } from './panels/ShuttlePanel'

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

  // Dùng cho các action thay đổi danh sách người / kỳ / admin users
  const submitGlobal = (action, msg) => submit(action, msg, 'global')

  if (activeTab === 'dashboard') {
    return (
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
    )
  }

  if (activeTab === 'analytics') {
    return (
      <AnalyticsPanel
        debts={data.debts}
        fund={data.fund}
        shuttleExpenses={data.shuttleExpenses}
        members={data.members}
        activePeriod={props.activePeriod}
      />
    )
  }

  if (activeTab === 'people') {
    return (
      <PeoplePanel
        people={people}
        form={forms.person}
        setForm={setForm}
        submit={submitGlobal}
      />
    )
  }

  if (activeTab === 'periods') {
    return (
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
    )
  }

  if (activeTab === 'sessions') {
    return (
      <SessionsPanel
        people={people}
        sessions={data.sessions}
        sessionForm={forms.session}
        guestForm={forms.guest}
        selectedPeriodId={selectedPeriodId}
        setForm={setForm}
        submit={submit}
      />
    )
  }

  if (activeTab === 'shuttle') {
    return (
      <ShuttlePanel
        people={people}
        expenses={data.shuttleExpenses}
        settlementPreview={data.settlementPreview}
        shuttleForm={forms.shuttle}
        selectedPeriodId={selectedPeriodId}
        setForm={setForm}
        submit={submit}
      />
    )
  }

  if (activeTab === 'debts') {
    return (
      <DebtsPanel
        people={people}
        debts={data.debts}
        selectedPersonId={selectedPersonId}
        setSelectedPersonId={setSelectedPersonId}
        createPayment={createPayment}
        checkout={checkout}
        submit={submit}
      />
    )
  }

  if (activeTab === 'pk') {
    return <PkPanel />
  }

  return (
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
  )
}

