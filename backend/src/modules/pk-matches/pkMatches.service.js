import { pkMatchesRepository } from "./pkMatches.repository.js";
import { assertPeopleActive } from "../../utils/peopleGuard.js";

const MATCH_TYPES = new Set(["singles", "doubles"]);
const OPEN_STATUSES = new Set(["pending", "active"]);
const MIN_MATCHES = 5;
const MIN_OPPONENTS = 3;

const DATABASE_ERROR_MESSAGES = [
  [/must belong to a period|Period ID is required/i, "Tr\u1eadn ph\u1ea3i thu\u1ed9c m\u1ed9t k\u1ef3 thi \u0111\u1ea5u."],
  [/Create the match first, then finalize it/i, "H\u00e3y t\u1ea1o tr\u1eadn tr\u01b0\u1edbc khi ghi k\u1ebft qu\u1ea3."],
  [/does not exist/i, "Kh\u00f4ng t\u00ecm th\u1ea5y tr\u1eadn \u0111\u1ea5u."],
  [/already completed and locked|completed PK match is locked/i, "Tr\u1eadn \u0111\u00e3 ho\u00e0n t\u1ea5t v\u00e0 b\u1ecb kh\u00f3a."],
  [/cannot be deleted/i, "Kh\u00f4ng th\u1ec3 x\u00f3a tr\u1eadn \u0111\u00e3 ho\u00e0n t\u1ea5t."],
  [/cancelled PK match cannot be completed/i, "Kh\u00f4ng th\u1ec3 ghi k\u1ebft qu\u1ea3 cho tr\u1eadn \u0111\u00e3 h\u1ee7y."],
  [/Winner side is invalid/i, "B\u00ean th\u1eafng kh\u00f4ng h\u1ee3p l\u1ec7."],
  [/Set scores are required/i, "Vui l\u00f2ng nh\u1eadp t\u1ef7 s\u1ed1 tr\u01b0\u1edbc khi ho\u00e0n t\u1ea5t tr\u1eadn."],
  [/Set score count exceeds/i, "S\u1ed1 v\u00e1n \u0111\u00e3 nh\u1eadp v\u01b0\u1ee3t qu\u00e1 c\u1ea5u h\u00ecnh tr\u1eadn."],
  [/Set score format is invalid/i, "\u0110\u1ecbnh d\u1ea1ng t\u1ef7 s\u1ed1 kh\u00f4ng h\u1ee3p l\u1ec7."],
  [/Each set must have one winner/i, "M\u1ed7i v\u00e1n ph\u1ea3i c\u00f3 m\u1ed9t b\u00ean th\u1eafng."],
  [/Winner side does not match/i, "B\u00ean th\u1eafng kh\u00f4ng kh\u1edbp v\u1edbi t\u1ef7 s\u1ed1 c\u00e1c v\u00e1n."],
  [/Complete or cancel earlier PK matches first/i, "Vui l\u00f2ng ho\u00e0n t\u1ea5t ho\u1eb7c h\u1ee7y c\u00e1c tr\u1eadn c\u00f3 s\u1ed1 th\u1ee9 t\u1ef1 nh\u1ecf h\u01a1n tr\u01b0\u1edbc."],
  [/void reason of at least 5 characters/i, "L\u00fd do h\u1ee7y k\u1ebft qu\u1ea3 ph\u1ea3i c\u00f3 \u00edt nh\u1ea5t 5 k\u00fd t\u1ef1."],
  [/Only a completed PK match can be voided/i, "Ch\u1ec9 c\u00f3 th\u1ec3 h\u1ee7y k\u1ebft qu\u1ea3 c\u1ee7a tr\u1eadn \u0111\u00e3 ho\u00e0n t\u1ea5t."],
  [/has already been voided/i, "K\u1ebft qu\u1ea3 tr\u1eadn n\u00e0y \u0111\u00e3 \u0111\u01b0\u1ee3c h\u1ee7y."],
];

function databaseError(error) {
  const translated = DATABASE_ERROR_MESSAGES.find(([pattern]) => pattern.test(error.message));
  return new Error(translated ? translated[1] : error.message);
}

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function formatDate(isoString) {
  const value = new Date(isoString);
  return `${String(value.getDate()).padStart(2, "0")}/${String(value.getMonth() + 1).padStart(2, "0")}/${value.getFullYear()}`;
}

function getTierKey(rating) {
  if (rating >= 1250) return "diamond";
  if (rating >= 1150) return "platinum";
  if (rating >= 1050) return "gold";
  if (rating >= 950) return "silver";
  return "bronze";
}

function participantIds(match) {
  return [
    match.challenger_id,
    match.challenger_partner_id,
    match.opponent_id,
    match.opponent_partner_id,
  ].filter(Boolean);
}

async function assertParticipant(match, user, isAdmin) {
  if (isAdmin) return;
  if (!user?.email) throw new Error("Kh\u00f4ng x\u00e1c \u0111\u1ecbnh \u0111\u01b0\u1ee3c t\u00e0i kho\u1ea3n.");

  const { data: person, error } = await pkMatchesRepository.getPersonByEmail(user.email);
  if (error) throw new Error(error.message);
  if (!person || !participantIds(match).includes(person.id)) {
    throw new Error("B\u1ea1n kh\u00f4ng ph\u1ea3i ng\u01b0\u1eddi tham gia tr\u1eadn n\u00e0y.");
  }
}

function buildInsert(payload, isAdmin) {
  const {
    match_type: matchType,
    challenger_id: challengerId,
    opponent_id: opponentId,
    challenger_partner_id: challengerPartnerId,
    opponent_partner_id: opponentPartnerId,
    period_id: periodId,
  } = payload;

  if (!MATCH_TYPES.has(matchType)) throw new Error("Lo\u1ea1i tr\u1eadn kh\u00f4ng h\u1ee3p l\u1ec7.");
  if (!periodId) throw new Error("Vui l\u00f2ng ch\u1ecdn k\u1ef3 thi \u0111\u1ea5u.");
  if (!challengerId || !opponentId) throw new Error("Vui l\u00f2ng ch\u1ecdn \u0111\u1ee7 hai b\u00ean thi \u0111\u1ea5u.");
  if (challengerId === opponentId) throw new Error("Kh\u00f4ng th\u1ec3 th\u00e1ch \u0111\u1ea5u ch\u00ednh m\u00ecnh.");
  if (!payload.played_at) throw new Error("Vui l\u00f2ng ch\u1ecdn ng\u00e0y thi \u0111\u1ea5u.");

  if (!isAdmin && startOfDay(payload.played_at) < startOfDay(new Date())) {
    throw new Error("Ng\u00e0y thi \u0111\u1ea5u kh\u00f4ng \u0111\u01b0\u1ee3c n\u1eb1m trong qu\u00e1 kh\u1ee9.");
  }

  if (matchType === "doubles") {
    const ids = [challengerId, opponentId, challengerPartnerId, opponentPartnerId];
    if (!challengerPartnerId || !opponentPartnerId) {
      throw new Error("Tr\u1eadn \u0111\u00f4i ph\u1ea3i c\u00f3 \u0111\u1ee7 b\u1ed1n ng\u01b0\u1eddi ch\u01a1i.");
    }
    if (new Set(ids).size !== 4) {
      throw new Error("M\u1ed9t ng\u01b0\u1eddi kh\u00f4ng th\u1ec3 xu\u1ea5t hi\u1ec7n hai l\u1ea7n trong c\u00f9ng tr\u1eadn.");
    }
  }

  return {
    match_type: matchType,
    period_id: periodId,
    challenger_id: challengerId,
    opponent_id: opponentId,
    challenger_partner_id: matchType === "doubles" ? challengerPartnerId : null,
    opponent_partner_id: matchType === "doubles" ? opponentPartnerId : null,
    sets: Number(payload.sets) || 1,
    bet_items: payload.bet_items || null,
    played_at: payload.played_at,
    note: payload.note || null,
    status: isAdmin && payload.status === "active" ? "active" : "pending",
    winner_side: null,
    set_scores: null,
  };
}

export const pkMatchesService = {
  async getAll(periodId) {
    const { data, error } = await pkMatchesRepository.getAll(periodId);
    if (error) throw databaseError(error);
    return data;
  },

  async getMyMatches(user, periodId) {
    const { data: person, error } = await pkMatchesRepository.getPersonByEmail(user?.email);
    if (error || !person) return [];
    return this.getByPerson(person.id, periodId);
  },

  async getByPerson(personId, periodId) {
    const { data, error } = await pkMatchesRepository.getByPerson(personId, periodId);
    if (error) throw databaseError(error);
    return data;
  },

  async getById(id) {
    const { data, error } = await pkMatchesRepository.getById(id);
    if (error) throw databaseError(error);
    return data;
  },

  async create(payload, isAdmin = false) {
    const insert = buildInsert(payload, isAdmin);
    await assertPeopleActive(participantIds(insert));
    const { data, error } = await pkMatchesRepository.create(insert);
    if (error) throw databaseError(error);
    return data;
  },

  async createBulk(matches, isAdmin = false, periodId = null) {
    if (!Array.isArray(matches) || matches.length === 0) {
      throw new Error("Danh s\u00e1ch tr\u1eadn \u0111ang tr\u1ed1ng.");
    }
    if (matches.length > 30) throw new Error("M\u1ed7i l\u1ea7n ch\u1ec9 \u0111\u01b0\u1ee3c t\u1ea1o t\u1ed1i \u0111a 30 tr\u1eadn.");

    const inserts = matches.map((match) => buildInsert({
      ...match,
      period_id: match.period_id || periodId,
    }, isAdmin));
    await assertPeopleActive([...new Set(inserts.flatMap(participantIds))]);

    const { data, error } = await pkMatchesRepository.createMany(inserts);
    if (error) throw databaseError(error);
    return data;
  },

  async finalize(id, payload, isAdmin = false, authUser = null) {
    if (!id) throw new Error("Thi\u1ebfu m\u00e3 tr\u1eadn \u0111\u1ea5u.");
    const existing = await this.getById(id);
    await assertParticipant(existing, authUser, isAdmin);

    if (!isAdmin && existing.played_at && startOfDay(existing.played_at) > startOfDay(new Date())) {
      throw new Error(`Ch\u01b0a \u0111\u1ebfn ng\u00e0y thi \u0111\u1ea5u (${formatDate(existing.played_at)}).`);
    }

    const { data, error } = await pkMatchesRepository.finalize(
      id,
      payload.winner_side,
      payload.set_scores,
      authUser?.email
    );
    if (error) throw databaseError(error);
    return data?.match || data;
  },

  async update(id, payload, isAdmin = false, authUser = null) {
    if (!id) throw new Error("Thi\u1ebfu m\u00e3 tr\u1eadn \u0111\u1ea5u.");
    const existing = await this.getById(id);
    await assertParticipant(existing, authUser, isAdmin);

    if (payload.winner_side || payload.status === "completed") {
      return this.finalize(id, payload, isAdmin, authUser);
    }

    if (existing.rating_locked_at || existing.status === "completed") {
      const allowedKeys = new Set(["note", "bet_items"]);
      if (Object.keys(payload).some((key) => !allowedKeys.has(key))) {
        throw new Error("Tr\u1eadn \u0111\u00e3 ho\u00e0n t\u1ea5t v\u00e0 b\u1ecb kh\u00f3a k\u1ebft qu\u1ea3.");
      }
    }

    if (existing.status === "cancelled" && !isAdmin) {
      throw new Error("Tr\u1eadn \u0111\u00e3 h\u1ee7y n\u00ean kh\u00f4ng th\u1ec3 thay \u0111\u1ed5i.");
    }

    const allowed = {};
    if (payload.status !== undefined) {
      if (!OPEN_STATUSES.has(payload.status) && payload.status !== "cancelled") {
        throw new Error("Tr\u1ea1ng th\u00e1i tr\u1eadn kh\u00f4ng h\u1ee3p l\u1ec7.");
      }
      allowed.status = payload.status;
    }
    if (payload.bet_items !== undefined) allowed.bet_items = payload.bet_items || null;
    if (payload.played_at !== undefined) allowed.played_at = payload.played_at;
    if (payload.note !== undefined) allowed.note = payload.note || null;
    if (payload.sets !== undefined) allowed.sets = Number(payload.sets) || 1;

    if (isAdmin && !existing.rating_locked_at) {
      for (const key of [
        "match_type", "challenger_id", "opponent_id",
        "challenger_partner_id", "opponent_partner_id",
      ]) {
        if (payload[key] !== undefined) allowed[key] = payload[key] || null;
      }
      const merged = { ...existing, ...allowed };
      await assertPeopleActive(participantIds(merged));
    }

    const { data, error } = await pkMatchesRepository.update(id, allowed);
    if (error) throw databaseError(error);
    return data;
  },

  async remove(id) {
    const existing = await this.getById(id);
    if (existing.rating_locked_at || existing.status === "completed") {
      throw new Error("Kh\u00f4ng th\u1ec3 x\u00f3a tr\u1eadn \u0111\u00e3 ho\u00e0n t\u1ea5t. Owner c\u00f3 th\u1ec3 h\u1ee7y k\u1ebft qu\u1ea3.");
    }
    const { error } = await pkMatchesRepository.remove(id);
    if (error) throw databaseError(error);
    return { id };
  },

  async voidResult(id, reason, authUser) {
    const { data, error } = await pkMatchesRepository.voidResult(id, reason, authUser?.email);
    if (error) throw databaseError(error);
    return data;
  },

  async getLeaderboard(periodId, matchType) {
    if (!periodId) throw new Error("Vui l\u00f2ng ch\u1ecdn k\u1ef3 thi \u0111\u1ea5u.");
    if (!MATCH_TYPES.has(matchType)) throw new Error("Lo\u1ea1i b\u1ea3ng x\u1ebfp h\u1ea1ng kh\u00f4ng h\u1ee3p l\u1ec7.");

    const { data = [], error } = await pkMatchesRepository.getSeasonRatings(periodId, matchType);
    if (error) throw databaseError(error);

    const ratingByPerson = new Map(data.map((row) => [row.person_id, Number(row.rating)]));
    const rows = data.map((row) => {
      const opponents = [...new Set(row.opponent_ids || [])];
      const knownRatings = opponents.map((id) => ratingByPerson.get(id)).filter(Number.isFinite);
      const opponentStrength = knownRatings.length
        ? knownRatings.reduce((sum, rating) => sum + rating, 0) / knownRatings.length
        : 1000;
      return {
        ...row.person,
        id: row.person_id,
        wins: row.wins,
        losses: row.losses,
        total_matches: row.matches,
        distinct_opponents: opponents.length,
        win_rate: row.matches ? Math.round((row.wins / row.matches) * 100) : 0,
        rating: Number(row.rating),
        opponent_strength: opponentStrength,
        tier_key: getTierKey(Number(row.rating)),
        qualified: row.matches >= MIN_MATCHES && opponents.length >= MIN_OPPONENTS,
      };
    });

    const ranked = rows
      .filter((row) => row.qualified)
      .sort((left, right) =>
        right.rating - left.rating ||
        right.opponent_strength - left.opponent_strength ||
        right.wins - left.wins ||
        left.total_matches - right.total_matches ||
        left.full_name.localeCompare(right.full_name, "vi")
      )
      .map((row, index) => {
        const { rating, opponent_strength: opponentStrength, qualified, ...publicRow } = row;
        void rating;
        void opponentStrength;
        void qualified;
        return { ...publicRow, rank: index + 1 };
      });

    const qualifying = rows
      .filter((row) => !row.qualified)
      .sort((left, right) => right.total_matches - left.total_matches || right.wins - left.wins)
      .map((row) => ({
        id: row.id,
        full_name: row.full_name,
        nickname: row.nickname,
        avatar_url: row.avatar_url,
        attendance_type: row.attendance_type,
        wins: row.wins,
        losses: row.losses,
        total_matches: row.total_matches,
        distinct_opponents: row.distinct_opponents,
        matches_needed: Math.max(0, MIN_MATCHES - row.total_matches),
        opponents_needed: Math.max(0, MIN_OPPONENTS - row.distinct_opponents),
      }));

    return {
      period_id: periodId,
      match_type: matchType,
      requirements: { min_matches: MIN_MATCHES, min_opponents: MIN_OPPONENTS },
      ranked,
      qualifying,
    };
  },

  async getPublicPeople() {
    const { data, error } = await pkMatchesRepository.getPublicPeople();
    if (error) throw databaseError(error);
    return data;
  },
};
