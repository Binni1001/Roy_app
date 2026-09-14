const PERSON_KEYS = ["person_id", "buyer_id", "challenger_id", "challenger_partner_id", "opponent_id", "opponent_partner_id"];
const ENTITY_TABLES = {
  "period-members": "period_members",
  "guest-attendances": "guest_attendances",
  "shuttle-expenses": "shuttle_expenses",
  debts: "debts",
  payments: "payments",
  "club-fund-transactions": "club_fund_transactions",
  "pk-matches": "pk_matches"
};

export function collectActivityPeople(body = {}) {
  const ids = PERSON_KEYS.map((key) => body?.[key]).filter(Boolean);
  if (Array.isArray(body.person_ids)) ids.push(...body.person_ids);
  if (Array.isArray(body.matches)) {
    for (const match of body.matches) ids.push(...collectActivityPeople(match));
  }
  return [...new Set(ids)];
}

// Admins may manage profiles and clean up old records, but may not create or
// resume activity for someone who is inactive. Existing records are not erased.
export function createActivityStatusGuard({ getRecord, getPeriodPeople, getTournamentPeople, assertActive }) {
  return async (req, res, next) => {
    if (!["POST", "PUT", "PATCH"].includes(req.method)) return next();
    const [module, id, action, operation] = req.path.toLowerCase().split("/").filter(Boolean);
    if (["people", "groups", "admin-users"].includes(module)) return next();
    if (module === "payments" && id === "payos-webhook") return next();
    if (module === "pk-matches" && (action === "void" ||
      (req.body?.status === "cancelled" && Object.keys(req.body).every((key) => ["status", "note"].includes(key))))) return next();
    try {
      const ids = collectActivityPeople(req.body);
      const table = ENTITY_TABLES[module];
      if (table && id && !["bulk", "deposit", "refund", "carry-over", "with-fund-split",
        "create-for-person", "create-for-person-period"].includes(id)) {
        const record = await getRecord(table, id);
        if (record) ids.push(...collectActivityPeople(record));
      }
      if (module === "balance-offsets" && id === "person") ids.push(action);
      if (module === "notifications" && id === "remind-debt") ids.push(action);
      if (module === "shuttle-settlements" && id === "period" && operation === "settle") {
        ids.push(...await getPeriodPeople(action));
      }
      if (module === "tournaments" && id) ids.push(...await getTournamentPeople(id));
      await assertActive([...new Set(ids.filter(Boolean))]);
      next();
    } catch (error) {
      res.status(400).json({ code: "ACTIVITY_PERSON_UNAVAILABLE", message: error.message });
    }
  };
}
