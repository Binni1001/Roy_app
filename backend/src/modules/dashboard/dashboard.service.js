import { dashboardRepository } from "./dashboard.repository.js";

export const dashboardService = {
  async getPeriodDashboard(periodId) {
    if (!periodId) {
      throw new Error("Period ID khong duoc de trong");
    }

    const periodResult = await dashboardRepository.getPeriod(periodId);
    if (periodResult.error) throw new Error(periodResult.error.message);

    const debtsResult = await dashboardRepository.getDebts(periodId);
    if (debtsResult.error) throw new Error(debtsResult.error.message);

    const fundResult = await dashboardRepository.getFundTransactions(periodId);
    if (fundResult.error) throw new Error(fundResult.error.message);

    const membersResult = await dashboardRepository.getFixedMembers(periodId);
    if (membersResult.error) throw new Error(membersResult.error.message);

    const shuttleResult = await dashboardRepository.getShuttleExpenses(periodId);
    if (shuttleResult.error) throw new Error(shuttleResult.error.message);

    const balancesResult = await dashboardRepository.getPersonBalances();
    if (balancesResult.error) throw new Error(balancesResult.error.message);

    const debts = debtsResult.data;
    const funds = fundResult.data;
    const fixedMembers = membersResult.data;
    const shuttleExpenses = shuttleResult.data;
    const balances = balancesResult.data;

    const totalDebt = debts
      .filter((d) => d.status !== "cancelled")
      .reduce((sum, d) => sum + Number(d.amount), 0);

    const paidDebt = debts
      .filter((d) => d.status === "paid")
      .reduce((sum, d) => sum + Number(d.amount), 0);

    const unpaidDebt = debts
      .filter((d) => d.status === "unpaid")
      .reduce((sum, d) => sum + Number(d.amount), 0);

    const cancelledDebt = debts
      .filter((d) => d.status === "cancelled")
      .reduce((sum, d) => sum + Number(d.amount), 0);

    const fundIncome = funds
      .filter((f) => f.transaction_type === "income")
      .reduce((sum, f) => sum + Number(f.amount), 0);

    const fundExpense = funds
      .filter((f) => f.transaction_type === "expense")
      .reduce((sum, f) => sum + Number(f.amount), 0);

    const fundRefund = funds
      .filter((f) => f.transaction_type === "refund")
      .reduce((sum, f) => sum + Number(f.amount), 0);

    const fundAdjustment = funds
      .filter((f) => f.transaction_type === "adjustment")
      .reduce((sum, f) => sum + Number(f.amount), 0);

    const fundBalance =
      fundIncome + fundAdjustment - fundExpense - fundRefund;

    const totalShuttleAmount = shuttleExpenses.reduce(
      (sum, e) => sum + Number(e.total_amount),
      0
    );

    const totalShuttleCount = shuttleExpenses.reduce(
      (sum, e) => sum + Number(e.total_shuttle_count),
      0
    );

    const positiveBalances = balances
      .filter((b) => Number(b.balance) > 0)
      .reduce((sum, b) => sum + Number(b.balance), 0);

    const negativeBalances = balances
      .filter((b) => Number(b.balance) < 0)
      .reduce((sum, b) => sum + Math.abs(Number(b.balance)), 0);

    const unpaidPeople = debts
      .filter((d) => d.status === "unpaid")
      .map((d) => ({
        debt_id: d.id,
        person_id: d.person_id,
        name: d.person?.nickname || d.person?.full_name,
        debt_type: d.debt_type,
        amount: Number(d.amount),
        description: d.description
      }));

    return {
      period: periodResult.data,

      members: {
        fixed_count: fixedMembers.length
      },

      debts: {
        total: totalDebt,
        paid: paidDebt,
        unpaid: unpaidDebt,
        cancelled: cancelledDebt,
        unpaid_people: unpaidPeople
      },

      fund: {
        income: fundIncome,
        expense: fundExpense,
        refund: fundRefund,
        adjustment: fundAdjustment,
        balance: fundBalance
      },

      shuttles: {
        total_amount: totalShuttleAmount,
        total_count: totalShuttleCount
      },

      balances: {
        positive_total: positiveBalances,
        negative_total: negativeBalances,
        items: balances
      }
    };
  }
};
