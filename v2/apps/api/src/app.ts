import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { requireAuth, type AuthEnv, type TokenVerifier } from "./auth.ts";
import { decide, listPending, type ApprovalStore } from "./routes/approvals.ts";
import {
  addGuest,
  addSession,
  changeDay,
  deleteGuest,
  editGuest,
  editSession,
  loadSchedule as loadAdminSchedule,
  removeSession,
  type AdminScheduleStore,
} from "./routes/adminSchedule.ts";
import {
  buildKnockout,
  cancelTournament,
  configureTournament,
  createTournament,
  deleteTournament,
  listAdminTournaments,
  loadAdminTournament,
  publishTournament,
  saveTournamentMatch,
  type AdminTournamentStore,
} from "./routes/adminTournaments.ts";
import { adminMatchAction, loadAdminMatches, type AdminMatchStore } from "./routes/adminMatches.ts";
import {
  addDebt as addDebtRoute,
  addFund,
  cancelDebt as cancelDebtRoute,
  collect,
  loadMoney,
  periodReport,
  remind,
  type MoneyStore,
} from "./routes/money.ts";
import {
  addExpense,
  addLoan,
  changeLoan,
  closeOpenPeriod,
  loadShuttles,
  removeExpense,
  settleShuttles,
  useFund,
  type ShuttleStore,
} from "./routes/shuttles.ts";
import { addMembers, changeMember, createPeriod, editPeriod, listPeriods, loadRoster, openPeriod, type PeriodsStore } from "./routes/periods.ts";
import { addPerson, changeStatus, editPerson, listPeople, type PeopleStore } from "./routes/people.ts";
import { loadAvailability, saveAvailability, type AvailabilityStore } from "./routes/availability.ts";
import { MAX_AVATAR_BYTES, parseAvatar, type AvatarStore } from "./routes/avatar.ts";
import { changeMatch, createMatch, type MatchStore } from "./routes/matches.ts";
import { checkInvite, joinGroup, switchGroup, type OnboardingStore } from "./routes/onboarding.ts";
import { parseProfileInput, ValidationError, type ProfileStore } from "./routes/profile.ts";
import { AccountInactiveError, loadBootstrap } from "./routes/bootstrap.ts";
import { ActionError, changeOpenDay, type ActionsStore, type OpenDayAction } from "./routes/actions.ts";
import { loadArena, type ArenaStore } from "./routes/arena.ts";
import { buildArenaHistory, type ArenaHistoryStore } from "./routes/arenaHistory.ts";
import { loadNotifications, loadTournament, NotFoundError, type ExtrasStore } from "./routes/extras.ts";
import {
  loadSchedule,
  loadWallet,
  NoGroupError,
  NoProfileError,
  resolveMember,
  type MemberStore,
} from "./routes/member.ts";

export interface AppDeps {
  verify: TokenVerifier;
  store: MemberStore &
    ArenaStore &
    ArenaHistoryStore &
    ExtrasStore &
    ActionsStore &
    ProfileStore &
    MatchStore &
    OnboardingStore &
    AvatarStore &
    AvailabilityStore &
    ApprovalStore &
    PeopleStore &
    PeriodsStore &
    AdminScheduleStore &
    ShuttleStore &
    MoneyStore &
    AdminMatchStore &
    AdminTournamentStore;
  corsOrigins: string[];
}

function fail(c: Context, error: unknown) {
  if (error instanceof AccountInactiveError) {
    return c.json(
      { code: "ACCOUNT_INACTIVE", message: "Tài khoản đã nghỉ. Liên hệ quản trị viên để kích hoạt lại." },
      403,
    );
  }
  if (error instanceof NoProfileError) {
    return c.json({ code: "NO_PROFILE", message: "Tài khoản chưa có hồ sơ người chơi." }, 404);
  }
  if (error instanceof ValidationError) {
    return c.json({ code: "INVALID", message: error.message }, 400);
  }
  if (error instanceof ActionError) {
    return c.json({ code: error.code, message: error.message }, error.status);
  }
  if (error instanceof NotFoundError) {
    return c.json({ code: "NOT_FOUND", message: "Không tìm thấy nội dung này." }, 404);
  }
  if (error instanceof NoGroupError) {
    return c.json({ code: "NO_GROUP", message: "Bạn chưa ở trong nhóm nào đang hoạt động." }, 403);
  }
  console.error(`[${c.req.path}]`, error);
  return c.json({ code: "INTERNAL", message: "Không tải được dữ liệu. Thử lại sau." }, 500);
}

export function createApp({ verify, store, corsOrigins }: AppDeps) {
  const app = new Hono<AuthEnv>();

  app.use(
    "*",
    cors({
      origin: corsOrigins,
      allowHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
      maxAge: 86400,
    }),
  );

  app.get("/health", (c) => c.json({ status: "ok", app: "roy_badminton_v2" }));

  const auth = requireAuth(verify);
  app.use("/bootstrap", auth);
  app.use("/me/*", auth);
  app.use("/onboarding/*", auth);
  app.use("/admin/*", auth);

  app.get("/admin/pending-members", async (c) => {
    try {
      return c.json(await listPending(c.get("user"), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.post("/admin/pending-members/:personId/:decision", async (c) => {
    try {
      const decision = c.req.param("decision");
      if (decision !== "approve" && decision !== "reject") {
        return c.json({ code: "NOT_FOUND", message: "Không tìm thấy nội dung này." }, 404);
      }
      return c.json(await decide(c.get("user"), c.req.param("personId"), decision, store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.get("/admin/tournaments", async (c) => {
    try {
      return c.json(await listAdminTournaments(c.get("user"), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.post("/admin/tournaments", async (c) => {
    try {
      return c.json(await createTournament(c.get("user"), await c.req.json().catch(() => null), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.get("/admin/tournaments/:id", async (c) => {
    try {
      return c.json(await loadAdminTournament(c.get("user"), c.req.param("id"), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.post("/admin/tournaments/:id/configure", async (c) => {
    try {
      return c.json(await configureTournament(c.get("user"), c.req.param("id"), await c.req.json().catch(() => null), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.post("/admin/tournaments/:id/publish", async (c) => {
    try {
      return c.json(await publishTournament(c.get("user"), c.req.param("id"), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.post("/admin/tournaments/:id/knockout", async (c) => {
    try {
      return c.json(await buildKnockout(c.get("user"), c.req.param("id"), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.post("/admin/tournaments/:id/cancel", async (c) => {
    try {
      return c.json(await cancelTournament(c.get("user"), c.req.param("id"), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.delete("/admin/tournaments/:id", async (c) => {
    try {
      return c.json(await deleteTournament(c.get("user"), c.req.param("id"), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.put("/admin/tournament-matches/:id", async (c) => {
    try {
      return c.json(await saveTournamentMatch(c.get("user"), c.req.param("id"), await c.req.json().catch(() => null), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.get("/admin/matches", async (c) => {
    try {
      return c.json(await loadAdminMatches(c.get("user"), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.post("/admin/matches/:id/:action", async (c) => {
    try {
      const body = await c.req.json().catch(() => null);
      return c.json(await adminMatchAction(c.get("user"), c.req.param("id"), c.req.param("action"), body, store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.get("/admin/money", async (c) => {
    try {
      return c.json(await loadMoney(c.get("user"), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.post("/admin/money/collect", async (c) => {
    try {
      return c.json(await collect(c.get("user"), await c.req.json().catch(() => null), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.post("/admin/money/debts", async (c) => {
    try {
      return c.json(await addDebtRoute(c.get("user"), await c.req.json().catch(() => null), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.post("/admin/money/debts/:id/cancel", async (c) => {
    try {
      return c.json(await cancelDebtRoute(c.get("user"), c.req.param("id"), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.post("/admin/money/remind/:id", async (c) => {
    try {
      return c.json(await remind(c.get("user"), c.req.param("id"), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.post("/admin/money/fund", async (c) => {
    try {
      return c.json(await addFund(c.get("user"), await c.req.json().catch(() => null), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.get("/admin/periods/:id/report", async (c) => {
    try {
      return c.json(await periodReport(c.get("user"), c.req.param("id"), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.get("/admin/shuttles", async (c) => {
    try {
      return c.json(await loadShuttles(c.get("user"), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.post("/admin/shuttles/expenses", async (c) => {
    try {
      return c.json(await addExpense(c.get("user"), await c.req.json().catch(() => null), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.delete("/admin/shuttles/expenses/:id", async (c) => {
    try {
      return c.json(await removeExpense(c.get("user"), c.req.param("id"), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.post("/admin/shuttles/loans", async (c) => {
    try {
      return c.json(await addLoan(c.get("user"), await c.req.json().catch(() => null), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.post("/admin/shuttles/loans/:id/:action", async (c) => {
    try {
      return c.json(await changeLoan(c.get("user"), c.req.param("id"), c.req.param("action"), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.post("/admin/shuttles/fund", async (c) => {
    try {
      return c.json(await useFund(c.get("user"), await c.req.json().catch(() => null), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.post("/admin/shuttles/settle", async (c) => {
    try {
      return c.json(await settleShuttles(c.get("user"), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.post("/admin/shuttles/close", async (c) => {
    try {
      return c.json(await closeOpenPeriod(c.get("user"), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.get("/admin/schedule", async (c) => {
    try {
      return c.json(await loadAdminSchedule(c.get("user"), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.post("/admin/schedule/days", async (c) => {
    try {
      return c.json(await changeDay(c.get("user"), await c.req.json().catch(() => null), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.post("/admin/sessions", async (c) => {
    try {
      return c.json(await addSession(c.get("user"), await c.req.json().catch(() => null), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.put("/admin/sessions/:id", async (c) => {
    try {
      return c.json(await editSession(c.get("user"), c.req.param("id"), await c.req.json().catch(() => null), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.delete("/admin/sessions/:id", async (c) => {
    try {
      return c.json(await removeSession(c.get("user"), c.req.param("id"), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.post("/admin/sessions/:id/guests", async (c) => {
    try {
      return c.json(await addGuest(c.get("user"), c.req.param("id"), await c.req.json().catch(() => null), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.put("/admin/guests/:id", async (c) => {
    try {
      return c.json(await editGuest(c.get("user"), c.req.param("id"), await c.req.json().catch(() => null), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.delete("/admin/guests/:id", async (c) => {
    try {
      return c.json(await deleteGuest(c.get("user"), c.req.param("id"), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.get("/admin/periods", async (c) => {
    try {
      return c.json(await listPeriods(c.get("user"), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.post("/admin/periods", async (c) => {
    try {
      return c.json(await createPeriod(c.get("user"), await c.req.json().catch(() => null), store), 201);
    } catch (error) {
      return fail(c, error);
    }
  });

  app.put("/admin/periods/:id", async (c) => {
    try {
      return c.json(await editPeriod(c.get("user"), c.req.param("id"), await c.req.json().catch(() => null), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.post("/admin/periods/:id/open", async (c) => {
    try {
      return c.json(await openPeriod(c.get("user"), c.req.param("id"), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.get("/admin/periods/:id/roster", async (c) => {
    try {
      return c.json(await loadRoster(c.get("user"), c.req.param("id"), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.post("/admin/periods/:id/members", async (c) => {
    try {
      return c.json(await addMembers(c.get("user"), c.req.param("id"), await c.req.json().catch(() => null), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.put("/admin/period-members/:id", async (c) => {
    try {
      return c.json(await changeMember(c.get("user"), c.req.param("id"), await c.req.json().catch(() => null), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.get("/admin/people", async (c) => {
    try {
      return c.json(await listPeople(c.get("user"), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.post("/admin/people", async (c) => {
    try {
      return c.json(await addPerson(c.get("user"), await c.req.json().catch(() => null), store), 201);
    } catch (error) {
      return fail(c, error);
    }
  });

  app.put("/admin/people/:id", async (c) => {
    try {
      const body = await c.req.json().catch(() => null);
      return c.json(await editPerson(c.get("user"), c.req.param("id"), body, store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.put("/admin/people/:id/status", async (c) => {
    try {
      const body = await c.req.json().catch(() => null);
      return c.json(await changeStatus(c.get("user"), c.req.param("id"), body, store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.get("/me/availability", async (c) => {
    try {
      const user = c.get("user");
      return c.json(await loadAvailability(user, await resolveMember(user, store), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.put("/me/availability", async (c) => {
    try {
      const user = c.get("user");
      const member = await resolveMember(user, store);
      return c.json(await saveAvailability(user, member, await c.req.json().catch(() => null), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  // Vào nhóm bằng mã mời: dùng được cả khi tài khoản chưa có hồ sơ hoặc chưa ở nhóm nào.
  app.post("/onboarding/check-invite", async (c) => {
    try {
      return c.json(await checkInvite(await c.req.json().catch(() => null), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.post("/onboarding/join", async (c) => {
    try {
      return c.json(await joinGroup(c.get("user"), await c.req.json().catch(() => null), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.put("/me/active-group", async (c) => {
    try {
      return c.json(await switchGroup(c.get("user"), await c.req.json().catch(() => null), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.get("/bootstrap", async (c) => {
    try {
      return c.json(await loadBootstrap(c.get("user"), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.get("/me/wallet", async (c) => {
    try {
      return c.json(await loadWallet(await resolveMember(c.get("user"), store), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.get("/me/schedule", async (c) => {
    try {
      return c.json(await loadSchedule(await resolveMember(c.get("user"), store), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.get("/me/arena", async (c) => {
    try {
      return c.json(await loadArena(await resolveMember(c.get("user"), store), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.get("/me/arena/players", async (c) => {
    try {
      const member = await resolveMember(c.get("user"), store);
      return c.json(await store.listGroupPlayers(member.groupId));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.post("/me/matches", async (c) => {
    try {
      const member = await resolveMember(c.get("user"), store);
      return c.json(await createMatch(member, await c.req.json().catch(() => null), store), 201);
    } catch (error) {
      return fail(c, error);
    }
  });

  app.post("/me/matches/:id/:action", async (c) => {
    try {
      const action = c.req.param("action");
      if (action !== "accept" && action !== "cancel" && action !== "result") {
        return c.json({ code: "NOT_FOUND", message: "Không tìm thấy nội dung này." }, 404);
      }
      const user = c.get("user");
      const member = await resolveMember(user, store);
      const body = action === "result" ? await c.req.json().catch(() => null) : null;
      return c.json(await changeMatch(user, member, c.req.param("id"), action, body, store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.get("/me/arena/history", async (c) => {
    try {
      const member = await resolveMember(c.get("user"), store);
      return c.json(buildArenaHistory(await store.listLeaderboardSnapshots(member.groupId)));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.get("/me/notifications", async (c) => {
    try {
      return c.json(await loadNotifications(await resolveMember(c.get("user"), store), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.get("/me/tournaments", async (c) => {
    try {
      const member = await resolveMember(c.get("user"), store);
      return c.json(await store.listTournaments(member.groupId));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.get("/me/tournaments/:id", async (c) => {
    try {
      const member = await resolveMember(c.get("user"), store);
      return c.json(await loadTournament(member, c.req.param("id"), store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.get("/me/profile", async (c) => {
    try {
      const member = await resolveMember(c.get("user"), store);
      const profile = await store.getProfile(member.personId);
      if (!profile) throw new NotFoundError();
      return c.json(profile);
    } catch (error) {
      return fail(c, error);
    }
  });

  app.put("/me/profile", async (c) => {
    try {
      const member = await resolveMember(c.get("user"), store);
      const input = parseProfileInput(await c.req.json().catch(() => null));
      return c.json(await store.updateProfile(member.personId, input));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.post("/me/notifications/read", async (c) => {
    try {
      const member = await resolveMember(c.get("user"), store);
      await store.markNotificationsRead(member.personId);
      return c.json(await loadNotifications(member, store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.delete("/me/notifications/:id?", async (c) => {
    try {
      const member = await resolveMember(c.get("user"), store);
      await store.deleteNotifications(member.personId, c.req.param("id") ?? null);
      return c.json(await loadNotifications(member, store));
    } catch (error) {
      return fail(c, error);
    }
  });

  app.post(
    "/me/avatar",
    bodyLimit({
      maxSize: MAX_AVATAR_BYTES,
      onError: (c) => c.json({ code: "AVATAR_TOO_LARGE", message: "Ảnh lớn hơn 2 MB." }, 413),
    }),
    async (c) => {
      try {
        const member = await resolveMember(c.get("user"), store);
        const { bytes, type } = parseAvatar(new Uint8Array(await c.req.arrayBuffer()));
        const url = await store.uploadAvatar(member.personId, bytes, type);
        await store.setAvatarUrl(member.personId, url);
        const profile = await store.getProfile(member.personId);
        if (!profile) throw new NotFoundError();
        return c.json(profile);
      } catch (error) {
        return fail(c, error);
      }
    },
  );

  app.post("/me/open-days/:id/:action", async (c) => {
    try {
      const action = c.req.param("action");
      if (action !== "join" && action !== "leave") {
        return c.json({ code: "NOT_FOUND", message: "Không tìm thấy nội dung này." }, 404);
      }
      const user = c.get("user");
      const member = await resolveMember(user, store);
      return c.json(await changeOpenDay(user, member, c.req.param("id"), action as OpenDayAction, store));
    } catch (error) {
      return fail(c, error);
    }
  });

  return app;
}
