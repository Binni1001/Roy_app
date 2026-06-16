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

  async create(payload) {
    const { match_type, challenger_id, opponent_id, challenger_partner_id, opponent_partner_id, bet_items, played_at, note } = payload;

    if (!match_type || !['singles', 'doubles'].includes(match_type)) {
      throw new Error("match_type phải là 'singles' hoặc 'doubles'");
    }
    if (!challenger_id) throw new Error("challenger_id là bắt buộc");
    if (!opponent_id)   throw new Error("opponent_id là bắt buộc");
    if (challenger_id === opponent_id) throw new Error("Không thể thách đấu chính mình");
    if (!played_at) throw new Error("Vui lòng chọn ngày đấu");

    // Ngày đấu không được là ngày trong quá khứ (trước hôm nay)
    const today = startOfDay(new Date());
    const matchDay = startOfDay(new Date(played_at));
    if (matchDay < today) throw new Error("Ngày đấu không được là ngày trong quá khứ");

    if (match_type === 'doubles') {
      if (!challenger_partner_id) throw new Error("Đánh đôi cần chọn đồng đội phía thách đấu");
      if (!opponent_partner_id)   throw new Error("Đánh đôi cần chọn đồng đội phía đối thủ");
    }

    await assertPeopleActive([challenger_id, opponent_id, challenger_partner_id, opponent_partner_id]);

    const insert = {
      match_type,
      challenger_id,
      opponent_id,
      challenger_partner_id: match_type === 'doubles' ? challenger_partner_id : null,
      opponent_partner_id:   match_type === 'doubles' ? opponent_partner_id   : null,
      bet_items:  bet_items  || null,
      played_at:  played_at  || null,
      note:       note       || null,
      status: 'pending',
    };

    const { data, error } = await pkMatchesRepository.create(insert);
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
    if (payload.bet_items !== undefined) allowed.bet_items = payload.bet_items;
    if (payload.played_at !== undefined) allowed.played_at = payload.played_at;
    if (payload.note      !== undefined) allowed.note      = payload.note;

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
