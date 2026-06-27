import { pkMatchesRepository } from "./pkMatches.repository.js";
import { assertPeopleActive } from "../../utils/peopleGuard.js";

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateStr(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
}

export const pkMatchesService = {
  async getAll() {
    const { data, error } = await pkMatchesRepository.getAll();
    if (error) throw new Error(error.message);
    return data;
  },

  async getMyMatches(user) {
    const { data: person, error: personError } = await import('../../config/supabase.js')
      .then(({ supabase }) => supabase.from('people').select('id').ilike('email', user.email).maybeSingle())
    if (personError || !person) return []
    return this.getByPerson(person.id)
  },

  async getByPerson(personId) {
    const { data, error } = await pkMatchesRepository.getByPerson(personId);
    if (error) throw new Error(error.message);
    return data;
  },

  async getById(id) {
    const { data, error } = await pkMatchesRepository.getById(id);
    if (error) throw new Error(error.message);
    return data;
  },

  // Validate + dựng object insert cho 1 kèo (không kiểm tra người active — caller tự gọi)
  _buildInsert(payload, isAdmin = false) {
    const { match_type, challenger_id, opponent_id, challenger_partner_id, opponent_partner_id, bet_items, played_at, note, status, winner_side, set_scores, sets } = payload;

    if (!match_type || !['singles', 'doubles'].includes(match_type)) {
      throw new Error("match_type phải là 'singles' hoặc 'doubles'");
    }
    if (!challenger_id) throw new Error("challenger_id là bắt buộc");
    if (!opponent_id)   throw new Error("opponent_id là bắt buộc");
    if (challenger_id === opponent_id) throw new Error("Không thể thách đấu chính mình");
    if (!played_at) throw new Error("Vui lòng chọn ngày đấu");

    if (!isAdmin) {
      const today = startOfDay(new Date());
      const matchDay = startOfDay(new Date(played_at));
      if (matchDay < today) throw new Error("Ngày đấu không được là ngày trong quá khứ");
    }

    if (match_type === 'doubles') {
      if (!challenger_partner_id) throw new Error("Đánh đôi cần chọn đồng đội phía thách đấu");
      if (!opponent_partner_id)   throw new Error("Đánh đôi cần chọn đồng đội phía đối thủ");
      // Không cho trùng người trong cùng 1 kèo đôi
      const ids = [challenger_id, opponent_id, challenger_partner_id, opponent_partner_id];
      if (new Set(ids).size !== 4) throw new Error("Một người không thể xuất hiện 2 lần trong cùng kèo đôi");
    }

    const resolvedStatus = isAdmin && status ? status : 'pending';
    return {
      match_type,
      challenger_id,
      opponent_id,
      challenger_partner_id: match_type === 'doubles' ? challenger_partner_id : null,
      opponent_partner_id:   match_type === 'doubles' ? opponent_partner_id   : null,
      sets:       Number(sets) || 1,
      bet_items:  bet_items  || null,
      played_at:  played_at  || null,
      note:       note       || null,
      status:     resolvedStatus,
      winner_side: resolvedStatus === 'completed' ? (winner_side || null) : null,
      set_scores:  resolvedStatus === 'completed' && set_scores?.length ? set_scores : null,
    };
  },

  async create(payload, isAdmin = false) {
    const insert = this._buildInsert(payload, isAdmin);
    await assertPeopleActive([insert.challenger_id, insert.opponent_id, insert.challenger_partner_id, insert.opponent_partner_id]);

    const { data, error } = await pkMatchesRepository.create(insert);
    if (error) throw new Error(error.message);
    return data;
  },

  async createBulk(matches, isAdmin = false) {
    if (!Array.isArray(matches) || matches.length === 0) throw new Error("Danh sách kèo trống");
    if (matches.length > 30) throw new Error("Tối đa 30 kèo mỗi lần tạo");

    const inserts = matches.map((m) => this._buildInsert(m, isAdmin));

    // Kiểm tra tất cả người tham gia active 1 lần duy nhất
    const allIds = [...new Set(
      inserts.flatMap((i) => [i.challenger_id, i.opponent_id, i.challenger_partner_id, i.opponent_partner_id].filter(Boolean))
    )];
    await assertPeopleActive(allIds);

    const { data, error } = await pkMatchesRepository.createMany(inserts);
    if (error) throw new Error(error.message);
    return data;
  },

  async update(id, payload, isAdmin = false, authUser = null) {
    if (!id) throw new Error("Match ID là bắt buộc");

    // Lấy trạng thái hiện tại của kèo
    const { data: existing, error: fetchError } = await pkMatchesRepository.getById(id);
    if (fetchError || !existing) throw new Error("Không tìm thấy kèo đấu");

    // ── Kiểm tra người gọi có trong kèo không ──
    if (!isAdmin && authUser?.email) {
      const { supabase } = await import("../../config/supabase.js");
      const { data: person } = await supabase.from('people').select('id').ilike('email', authUser.email).maybeSingle();
      const participantIds = [
        existing.challenger_id, existing.opponent_id,
        existing.challenger_partner_id, existing.opponent_partner_id,
      ].filter(Boolean);
      if (!person || !participantIds.includes(person.id)) {
        throw new Error("Bạn không phải người trong kèo này");
      }
    }

    const now      = new Date();
    const today    = startOfDay(now);
    const matchDay = existing.played_at ? startOfDay(new Date(existing.played_at)) : null;

    // ── Rule 1: Không ghi kết quả khi chưa đến ngày đấu ──
    if (payload.winner_side && !isAdmin) {
      if (!matchDay) throw new Error("Kèo chưa có ngày đấu, vui lòng cập nhật ngày đấu trước");
      if (matchDay > today) {
        throw new Error(`Chưa đến ngày đấu (${formatDateStr(existing.played_at)}), không thể ghi kết quả`);
      }
    }

    // ── Rule 2: Kết quả bị khoá sau 24 giờ kể từ khi ghi nhận ──
    if (payload.winner_side !== undefined && existing.status === 'completed' && !isAdmin) {
      const completedAt  = new Date(existing.updated_at);
      const diffHours    = (now - completedAt) / (1000 * 60 * 60);
      if (diffHours > 24) {
        throw new Error("Kết quả đã bị khoá sau 24 giờ kể từ khi ghi nhận, chỉ admin mới sửa được");
      }
    }

    // ── Rule 3: Không đặt lại "Chờ xác nhận" khi đã qua ngày đấu ──
    if (payload.status === 'pending' && matchDay && matchDay < today && !isAdmin) {
      throw new Error("Đã qua ngày đấu, không thể đặt lại trạng thái chờ");
    }

    // ── Rule 4: Kèo đã bị huỷ không thể thay đổi (trừ admin) ──
    if (existing.status === 'cancelled' && !isAdmin) {
      throw new Error("Kèo đã bị huỷ, không thể thay đổi");
    }

    const allowed = {};
    if (payload.status !== undefined) {
      if (!['pending', 'active', 'completed', 'cancelled'].includes(payload.status)) {
        throw new Error("status không hợp lệ");
      }
      allowed.status = payload.status;
    }
    if (payload.winner_side !== undefined) {
      if (payload.winner_side && !['challenger', 'opponent'].includes(payload.winner_side)) {
        throw new Error("winner_side phải là 'challenger' hoặc 'opponent'");
      }
      allowed.winner_side = payload.winner_side;
      if (payload.winner_side) allowed.status = 'completed';
    }
    if (payload.bet_items  !== undefined) allowed.bet_items  = payload.bet_items;
    if (payload.played_at  !== undefined) allowed.played_at  = payload.played_at;
    if (payload.note       !== undefined) allowed.note       = payload.note;
    if (payload.set_scores !== undefined) allowed.set_scores = payload.set_scores;
    if (payload.sets       !== undefined) allowed.sets       = Number(payload.sets) || 1;

    if (isAdmin) {
      if (payload.match_type          !== undefined) allowed.match_type          = payload.match_type;
      if (payload.challenger_id       !== undefined) allowed.challenger_id       = payload.challenger_id;
      if (payload.opponent_id         !== undefined) allowed.opponent_id         = payload.opponent_id;
      if (payload.challenger_partner_id !== undefined) allowed.challenger_partner_id = payload.challenger_partner_id || null;
      if (payload.opponent_partner_id   !== undefined) allowed.opponent_partner_id   = payload.opponent_partner_id   || null;
    }

    const { data, error } = await pkMatchesRepository.update(id, allowed);
    if (error) throw new Error(error.message);
    return data;
  },

  async remove(id) {
    if (!id) throw new Error('Match ID là bắt buộc')
    const { error } = await pkMatchesRepository.remove(id)
    if (error) throw new Error(error.message)
    return { id }
  },

  async getLeaderboard() {
    const { data, error } = await pkMatchesRepository.getLeaderboard();
    if (error) throw new Error(error.message);
    return data;
  },

  async getPublicPeople() {
    const { data, error } = await pkMatchesRepository.getPublicPeople();
    if (error) throw new Error(error.message);
    return data;
  },
};
