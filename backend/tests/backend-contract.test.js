import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function read(path) {
  return readFileSync(path, "utf8");
}

function listFiles(dir, predicate = () => true) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory()
      ? listFiles(path, predicate)
      : predicate(path)
        ? [path]
        : [];
  });
}

test("app mounts all active backend modules", () => {
  const app = read("src/app.js");
  const mounts = [
    "/api/people",
    "/api/periods",
    "/api/period-members",
    "/api/badminton-sessions",
    "/api/guest-attendances",
    "/api/debts",
    "/api/shuttle-expenses",
    "/api/shuttle-settlements",
    "/api/person-balances",
    "/api/balance-offsets",
    "/api/club-fund-transactions",
    "/api/dashboard",
    "/api/payments",
    "/api/admin-users"
  ];

  for (const mount of mounts) {
    assert.match(app, new RegExp(`app\\.use\\("${mount.replaceAll("/", "\\/")}"`));
  }
});

test("admin user management requires owner role", () => {
  const routes = read("src/modules/admin-users/adminUsers.routes.js");
  const service = read("src/modules/admin-users/adminUsers.service.js");

  assert.match(routes, /requireAuth/);
  assert.match(routes, /requireOwner/);
  assert.match(routes, /router\.post\("\/"/);
  assert.match(service, /inviteUserByEmail/);
  assert.match(service, /app_metadata/);
  assert.match(service, /role/);
});

test("people module exposes authenticated self profile endpoints", () => {
  const routes = read("src/modules/people/people.routes.js");
  const controller = read("src/modules/people/people.controller.js");
  const service = read("src/modules/people/people.service.js");

  assert.match(routes, /requireAuth/);
  assert.match(routes, /router\.get\("\/me", requireAuth/);
  assert.match(routes, /router\.post\("\/me", requireAuth/);
  assert.match(routes, /router\.put\("\/me", requireAuth/);
  assert.match(controller, /getMe/);
  assert.match(controller, /createMe/);
  assert.match(controller, /updateMe/);
  assert.match(service, /getPersonByAuthUser/);
  assert.match(service, /createPersonForAuthUser/);
  assert.match(service, /updatePersonForAuthUser/);
});

test("admin write routes require admin role", () => {
  const routeFiles = [
    "src/modules/people/people.routes.js",
    "src/modules/periods/periods.routes.js",
    "src/modules/period-members/periodMembers.routes.js",
    "src/modules/badminton-sessions/badmintonSessions.routes.js",
    "src/modules/debts/debts.routes.js",
    "src/modules/shuttle-expenses/shuttleExpenses.routes.js",
    "src/modules/shuttle-settlements/shuttleSettlements.routes.js",
    "src/modules/club-fund-transactions/clubFundTransactions.routes.js",
    "src/modules/balance-offsets/balanceOffsets.routes.js",
    "src/modules/dashboard/dashboard.routes.js"
  ];

  for (const file of routeFiles) {
    const routes = read(file);
    assert.match(routes, /requireAuth/, `${file} should require auth`);
    assert.match(routes, /requireAdmin/, `${file} should require admin`);
  }
});

test("person scoped user routes require matching profile ownership", () => {
  const routeFiles = [
    "src/modules/debts/debts.routes.js",
    "src/modules/person-balances/personBalances.routes.js",
    "src/modules/guest-attendances/guestAttendances.routes.js",
    "src/modules/payments/payments.routes.js"
  ];

  for (const file of routeFiles) {
    const routes = read(file);
    assert.match(routes, /requireAuth/, `${file} should require auth`);
    assert.match(routes, /requireSelfPersonOrAdmin|requirePaymentOwnerOrAdmin/, `${file} should verify ownership`);
  }
});

test("app applies security and rate limit middleware", () => {
  const app = read("src/app.js");

  assert.match(app, /securityHeaders/);
  assert.match(app, /cors\(corsOptions\(\)\)/);
  assert.match(app, /express\.json\(\{ limit:/);
  assert.match(app, /generalApiLimiter/);
  assert.match(app, /writeApiLimiter/);
  assert.match(app, /paymentLimiter/);
  assert.match(app, /webhookLimiter/);
  assert.match(app, /idempotencyMiddleware/);
});

test("security middleware stays dependency-free and configurable", () => {
  const middleware = read("src/middleware/security.js");

  assert.match(middleware, /RATE_LIMIT_API_PER_MINUTE/);
  assert.match(middleware, /RATE_LIMIT_WRITE_PER_MINUTE/);
  assert.match(middleware, /RATE_LIMIT_PAYMENT_PER_MINUTE/);
  assert.match(middleware, /RATE_LIMIT_WEBHOOK_PER_MINUTE/);
  assert.match(middleware, /CORS_ORIGINS/);
  assert.match(middleware, /FRONTEND_URL/);
  assert.match(middleware, /Idempotency-Key/);
});

test("payments controller has a single PayOS webhook handler", () => {
  const controller = read("src/modules/payments/payments.controller.js");
  const matches = controller.match(/async payosWebhook/g) || [];

  assert.equal(matches.length, 1);
  assert.doesNotMatch(controller, /Webhook received but not processed/);
});

test("payments repository has no duplicate legacy pending-payment method", () => {
  const repository = read("src/modules/payments/payments.repository.js");

  assert.doesNotMatch(repository, /findPendingPayment/);
  assert.match(repository, /getPendingPayments/);
  assert.match(repository, /process_paid_payment/);
  assert.match(repository, /mark_payment_failed/);
});

test("debt payments are grouped by club and keep their original period", () => {
  const debtRoutes = read("src/modules/debts/debts.routes.js");
  const debtRepository = read("src/modules/debts/debts.repository.js");
  const paymentRepository = read("src/modules/payments/payments.repository.js");
  const migration = read("../supabase/20260721_grouped_debt_payment.sql");
  const periodsService = read("src/modules/periods/periods.service.js");

  assert.match(debtRoutes, /period\/:periodId\/ledger/);
  assert.match(debtRepository, /getUnpaidByGroupId/);
  assert.match(debtRepository, /period\.group_id/);
  assert.match(paymentRepository, /getUnpaidDebtsByGroup/);
  assert.doesNotMatch(paymentRepository, /getUnpaidDebtsAllPeriods/);
  assert.match(periodsService, /group_id: groupId/);
  assert.match(migration, /update public\.periods p/);
  assert.match(migration, /group_id is not distinct from v_group_id/);
  assert.match(migration, /and debt_id = v_debt\.id/);
});

test("period creation resolves a safe group for legacy owner accounts", () => {
  const controller = read("src/modules/periods/periods.controller.js");
  const service = read("src/modules/periods/periods.service.js");
  const repository = read("src/modules/periods/periods.repository.js");

  assert.match(controller, /req\.authUser, req\.authRole/);
  assert.match(service, /requestedGroupId/);
  assert.match(service, /authRole !== "owner" && requestedGroupId !== profileGroupId/);
  assert.match(service, /getGroupsForOwnerFallback/);
  assert.match(service, /fallbackResult\.data\?\.length === 1/);
  assert.match(repository, /getGroupById/);
  assert.match(repository, /getGroupsForOwnerFallback/);
});

test("backend source contains no common mojibake sequences", () => {
  const files = listFiles("src", (path) => path.endsWith(".js"));
  const mojibake = /Ã.|Â.|â[€–—]|Ä[‘’]|á[»º]|ðŸ/;

  for (const file of files) {
    const text = read(file);
    assert.equal(mojibake.test(text), false, `${file} contains mojibake text`);
  }
});

test("finance RPC migration exposes required functions", () => {
  const sql = read("../supabase/20260613_atomic_finance_rpc.sql");
  const functions = [
    "process_paid_payment",
    "mark_payment_failed",
    "settle_shuttle_period",
    "offset_person_period"
  ];

  for (const name of functions) {
    assert.match(sql, new RegExp(`create or replace function public\\.${name}`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${name}`));
  }
});

test("people profile migration adds attendance type and unique email", () => {
  const sql = read("../supabase/20260613_people_auth_profile.sql");

  assert.match(sql, /attendance_type/);
  assert.match(sql, /people_attendance_type_check/);
  assert.match(sql, /people_email_unique_not_null/);
});

test("PK seasonal Elo migration locks finalized matches and preserves match order", () => {
  const sql = read("../supabase/20260713_pk_season_elo.sql");

  assert.match(sql, /add column if not exists match_number integer/);
  assert.match(sql, /pk_matches_period_match_number_unique/);
  assert.match(sql, /create table if not exists public\.pk_season_ratings/);
  assert.match(sql, /create table if not exists public\.pk_rating_events/);
  assert.match(sql, /create or replace function public\.finalize_pk_match/);
  assert.match(sql, /create or replace function public\.void_pk_match/);
  assert.match(sql, /create or replace function public\.rebuild_pk_season_elo/);
  assert.match(sql, /coalesce\(current_setting\('app\.pk_finalize', true\), 'off'\) <> 'on'/);
  assert.match(sql, /where period_id = '7ee421b7-1ec9-54de-8a82-ea9a31ba72fa'::uuid/);
  assert.doesNotMatch(sql, /where period_id = '34ac4b6a-675c-585c-84c0-ab24ba69f50c'::uuid/);
});

test("PK API finalizes matches separately and reserves voiding for owner", () => {
  const routes = read("src/modules/pk-matches/pkMatches.routes.js");
  const repository = read("src/modules/pk-matches/pkMatches.repository.js");
  const service = read("src/modules/pk-matches/pkMatches.service.js");

  assert.match(routes, /router\.post\("\/:id\/finalize", requireAuth/);
  assert.match(routes, /router\.post\("\/:id\/void", requireAuth, requireOwner/);
  assert.match(repository, /rpc\("finalize_pk_match"/);
  assert.match(repository, /rpc\("void_pk_match"/);
  assert.doesNotMatch(repository, /from\("pk_leaderboard"\)/);
  assert.match(service, /MIN_MATCHES = 5/);
  assert.match(service, /MIN_OPPONENTS = 3/);
  assert.match(service, /function getSeasonTierKey\(index, totalPlayers\)/);
  assert.match(service, /if \(index === 0\) return "champion"/);
  assert.match(service, /tier_key: getSeasonTierKey\(index, rankedRows\.length\)/);
  assert.match(service, /const \{ rating, opponent_strength:/);
  assert.match(service, /points: Math\.round\(rating\)/);
});
