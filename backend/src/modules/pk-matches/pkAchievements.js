const ENERGETIC_MATCHES = 8;
const ENERGETIC_DAYS = 3;
const WINNING_STREAK = 3;

export const EMPTY_SEASON_ACHIEVEMENTS = Object.freeze({
  requirements: {
    energetic_matches: ENERGETIC_MATCHES,
    energetic_days: ENERGETIC_DAYS,
    winning_streak: WINNING_STREAK,
  },
  energetic: [],
  winning_streak: { count: 0, players: [] },
  most_played: { count: 0, players: [] },
  by_person: {},
});

function personFromMatch(match, side, partner = false) {
  const key = partner ? `${side}_partner` : side;
  const id = match[`${key}_id`];
  if (!id) return null;

  const profile = match[key] || {};
  return {
    id,
    full_name: profile.full_name || "Người chơi",
    nickname: profile.nickname || null,
    avatar_url: profile.avatar_url || null,
  };
}

function sidePlayers(match, side) {
  return [
    personFromMatch(match, side),
    personFromMatch(match, side, true),
  ].filter(Boolean);
}

function playedDate(match) {
  const value = match.played_at || match.completed_at || match.created_at;
  return value ? String(value).slice(0, 10) : null;
}

function compareMatches(left, right) {
  const leftNumber = Number.isFinite(Number(left.match_number)) ? Number(left.match_number) : Number.MAX_SAFE_INTEGER;
  const rightNumber = Number.isFinite(Number(right.match_number)) ? Number(right.match_number) : Number.MAX_SAFE_INTEGER;
  if (leftNumber !== rightNumber) return leftNumber - rightNumber;

  const leftTime = Date.parse(left.completed_at || left.created_at || 0) || 0;
  const rightTime = Date.parse(right.completed_at || right.created_at || 0) || 0;
  return leftTime - rightTime || String(left.id || "").localeCompare(String(right.id || ""));
}

function publicPlayer(stat) {
  return {
    id: stat.id,
    full_name: stat.full_name,
    nickname: stat.nickname,
    avatar_url: stat.avatar_url,
    total_matches: stat.total_matches,
    play_days: stat.play_dates.size,
    wins: stat.wins,
    losses: stat.losses,
    current_streak: stat.current_streak,
    best_streak: stat.best_streak,
  };
}

function comparePlayers(left, right) {
  return right.total_matches - left.total_matches ||
    right.play_days - left.play_days ||
    right.best_streak - left.best_streak ||
    left.full_name.localeCompare(right.full_name, "vi");
}

export function buildSeasonAchievements(matches = []) {
  const eligibleMatches = matches
    .filter((match) =>
      match.status === "completed" &&
      !match.voided_at &&
      (match.winner_side === "challenger" || match.winner_side === "opponent")
    )
    .sort(compareMatches);

  if (eligibleMatches.length === 0) return EMPTY_SEASON_ACHIEVEMENTS;

  const stats = new Map();
  const ensureStat = (person) => {
    if (!stats.has(person.id)) {
      stats.set(person.id, {
        ...person,
        total_matches: 0,
        wins: 0,
        losses: 0,
        current_streak: 0,
        best_streak: 0,
        play_dates: new Set(),
      });
    }
    return stats.get(person.id);
  };

  for (const match of eligibleMatches) {
    const challengerPlayers = sidePlayers(match, "challenger");
    const opponentPlayers = sidePlayers(match, "opponent");
    const winners = match.winner_side === "challenger" ? challengerPlayers : opponentPlayers;
    const losers = match.winner_side === "challenger" ? opponentPlayers : challengerPlayers;
    const date = playedDate(match);

    for (const person of winners) {
      const stat = ensureStat(person);
      stat.total_matches += 1;
      stat.wins += 1;
      stat.current_streak += 1;
      stat.best_streak = Math.max(stat.best_streak, stat.current_streak);
      if (date) stat.play_dates.add(date);
    }

    for (const person of losers) {
      const stat = ensureStat(person);
      stat.total_matches += 1;
      stat.losses += 1;
      stat.current_streak = 0;
      if (date) stat.play_dates.add(date);
    }
  }

  const players = [...stats.values()].map(publicPlayer).sort(comparePlayers);
  const energetic = players.filter((player) =>
    player.total_matches >= ENERGETIC_MATCHES && player.play_days >= ENERGETIC_DAYS
  );
  const longestCurrentStreak = Math.max(0, ...players.map((player) => player.current_streak));
  const mostMatches = Math.max(0, ...players.map((player) => player.total_matches));
  const streakPlayers = longestCurrentStreak >= WINNING_STREAK
    ? players.filter((player) => player.current_streak === longestCurrentStreak)
    : [];
  const mostPlayedPlayers = mostMatches > 0
    ? players.filter((player) => player.total_matches === mostMatches)
    : [];
  const energeticIds = new Set(energetic.map((player) => player.id));
  const streakIds = new Set(streakPlayers.map((player) => player.id));
  const mostPlayedIds = new Set(mostPlayedPlayers.map((player) => player.id));

  return {
    requirements: EMPTY_SEASON_ACHIEVEMENTS.requirements,
    energetic,
    winning_streak: { count: streakPlayers.length ? longestCurrentStreak : 0, players: streakPlayers },
    most_played: { count: mostMatches, players: mostPlayedPlayers },
    by_person: Object.fromEntries(players.map((player) => [player.id, {
      energetic: energeticIds.has(player.id),
      winning_streak: streakIds.has(player.id),
      most_played: mostPlayedIds.has(player.id),
      total_matches: player.total_matches,
      play_days: player.play_days,
      current_streak: player.current_streak,
      best_streak: player.best_streak,
    }])),
  };
}
