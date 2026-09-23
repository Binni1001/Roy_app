import express from "express";
import cors from "cors";
import {
  corsOptions,
  generalApiLimiter,
  paymentLimiter,
  securityHeaders,
  webhookLimiter,
  writeApiLimiter
} from "./middleware/security.js";
import { idempotencyMiddleware } from "./middleware/idempotency.js";
import { requireAuth } from "./middleware/auth.js";
import { activityStatusGuard } from "./middleware/activityStatusDb.js";
import { adminScopeRollout } from "./middleware/adminScopeRollout.js";
import { adminResourceScope } from "./middleware/adminResourceScope.js";
import { attendanceGroupScope } from "./middleware/attendanceGroupScope.js";

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
import adminUsersRoutes from "./modules/admin-users/adminUsers.routes.js";
import pkMatchesRoutes from "./modules/pk-matches/pkMatches.routes.js";
import notificationsRoutes from "./modules/notifications/notifications.routes.js";
import groupsRoutes from "./modules/groups/groups.routes.js";
import tournamentsRoutes from "./modules/tournaments/tournaments.routes.js";
import sessionPlanningRoutes from "./modules/session-planning/sessionPlanning.routes.js";

const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(securityHeaders);
app.use(cors(corsOptions()));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "64kb" }));

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

app.use("/api", generalApiLimiter);
app.use("/api", writeApiLimiter);
app.use("/api/payments/create-for-person-period", paymentLimiter);
app.use("/api/payments/:id/cancel", paymentLimiter);
app.use("/api/payments/payos-webhook", webhookLimiter);
// Authenticate before replaying cached writes, so an inactive account cannot replay.
// PayOS callbacks acknowledge money already sent; they are verified by the payment service.
app.use("/api", (req, res, next) => {
  if (req.method === "POST" && /^\/payments\/payos-webhook\/?$/i.test(req.path)) return next();
  return requireAuth(req, res, next);
});
app.use("/api", adminScopeRollout);
app.use("/api", adminResourceScope);
app.use("/api", attendanceGroupScope);
app.use("/api", activityStatusGuard);
// Planning rechecks group/self eligibility on every request and uses DB revisions,
// not the generic replay cache (a cached response could outlive authorization).
app.use("/api/session-planning", sessionPlanningRoutes);
app.use("/api", idempotencyMiddleware);

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
app.use("/api/admin-users", adminUsersRoutes);
app.use("/api/pk-matches", pkMatchesRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/groups", groupsRoutes);
app.use("/api/tournaments", tournamentsRoutes);

export default app;
