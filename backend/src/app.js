import express from "express";
import cors from "cors";

import peopleRoutes from "./modules/people/people.routes.js";
import periodsRoutes from "./modules/periods/periods.routes.js";
import periodMembersRoutes from "./modules/period-members/periodMembers.routes.js";
import badmintonSessionsRoutes from "./modules/badminton-sessions/badmintonSessions.routes.js";
import guestAttendancesRoutes from "./modules/guest-attendances/guestAttendances.routes.js";
import debtsRoutes from "./modules/debts/debts.routes.js";
import shuttleExpensesRoutes from "./modules/shuttle-expenses/shuttleExpenses.routes.js";
import shuttleSettlementsRoutes from "./modules/shuttle-settlements/shuttleSettlements.routes.js";
import personBalancesRoutes from "./modules/person-balances/personBalances.routes.js";
import balanceOffsetsRoutes from "./modules/balance-offsets/balanceOffsets.routes.js";
import clubFundTransactionsRoutes from "./modules/club-fund-transactions/clubFundTransactions.routes.js";
import dashboardRoutes from "./modules/dashboard/dashboard.routes.js";
import paymentsRoutes from "./modules/payments/payments.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Roy Badminton API is running"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "roy_badminton"
  });
});

app.use("/api/people", peopleRoutes);
app.use("/api/periods", periodsRoutes);
app.use("/api/period-members", periodMembersRoutes);
app.use("/api/badminton-sessions", badmintonSessionsRoutes);
app.use("/api/guest-attendances", guestAttendancesRoutes);
app.use("/api/debts", debtsRoutes);
app.use("/api/shuttle-expenses", shuttleExpensesRoutes);
app.use("/api/shuttle-settlements", shuttleSettlementsRoutes);
app.use("/api/person-balances", personBalancesRoutes);
app.use("/api/balance-offsets", balanceOffsetsRoutes);
app.use("/api/club-fund-transactions", clubFundTransactionsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/payments", paymentsRoutes);

export default app;
