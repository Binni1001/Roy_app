import { pkMatchesRepository } from "./pkMatches.repository.js";

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
    if (!opponent_id) throw new Error("opponent_id là bắt buộc");
    if (challenger_id === opponent_id) throw new Error("Không thể thách đấu chính mình");
    if (match_type === 'doubles') {
      if (!challenger_partner_id) throw new Error("Đánh đôi cần chọn đồng đội phía thách đấu");
      if (!opponent_partner_id) throw new Error("Đánh đôi cần chọn đồng đội phía đối thủ");
    }

    const insert = {
      match_type,
      challenger_id,
      opponent_id,
      challenger_partner_id: match_type === 'doubles' ? challenger_partner_id : null,
      opponent_partner_id: match_type === 'doubles' ? opponent_partner_id : null,
      bet_items: bet_items || null,
      played_at: played_at || null,
      note: note || null,
      status: 'pending',
    };

    const { data, error } = await pkMatchesRepository.create(insert);
    if (error) throw new Error(error.message);
    return data;
  },

  async update(id, payload) {
    if (!id) throw new Error("Match ID là bắt buộc");

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
    if (payload.note !== undefined) allowed.note = payload.note;

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
