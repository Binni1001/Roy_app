/* ──────────────────────────────────────────────────────────
   Hàm thuần (pure) cho ghép cặp ngẫu nhiên 1 trận.
   (Ghép nhiều trận xem scheduleUtils.js)
   ────────────────────────────────────────────────────────── */

export function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/* ── Rank helpers ── */
export function buildRankMap(leaderboard) {
  const map = {}
  leaderboard.forEach((lb) => { map[lb.id] = lb.rank || 999 })
  return map
}

export function sortByRank(people, rankMap) {
  return [...people].sort((a, b) => (rankMap[a.id] || 500) - (rankMap[b.id] || 500))
}

export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* ── Pairing algorithms ── */
// Singles: sort selected by rank → snake pairs (1 vs N, 2 vs N-1, ...) → pick one random pair
export function pairSingles(selected, rankMap, lockedPerson) {
  const sorted = sortByRank(selected, rankMap)
  const n = sorted.length
  const pairs = []
  for (let i = 0; i < Math.floor(n / 2); i++) {
    pairs.push([sorted[i], sorted[n - 1 - i]])
  }
  const pair = pairs[Math.floor(Math.random() * pairs.length)]
  if (lockedPerson) {
    const other = pair[0].id === lockedPerson.id ? pair[1] : pair[0]
    return { match_type: 'singles', challenger: lockedPerson, opponent: other, challenger_partner: null, opponent_partner: null }
  }
  const [a, b] = Math.random() > 0.5 ? pair : [pair[1], pair[0]]
  return { match_type: 'singles', challenger: a, opponent: b, challenger_partner: null, opponent_partner: null }
}

// Doubles: pick 4 from selected (equal probability), sort by rank → r1+r4 vs r2+r3
export function pairDoubles(selected, rankMap, lockedPerson) {
  let pool
  if (lockedPerson) {
    const others = shuffle(selected.filter((p) => p.id !== lockedPerson.id)).slice(0, 3)
    pool = [lockedPerson, ...others]
  } else {
    pool = shuffle(selected).slice(0, 4)
  }
  const sorted = sortByRank(pool, rankMap)
  const [r1, r2, r3, r4] = sorted

  if (lockedPerson) {
    // lockedPerson always challenger — pair them with weakest (r4)
    const rest = sorted.filter((p) => p.id !== lockedPerson.id) // r of others sorted
    // self + weakest of others vs 2 middle
    return {
      match_type: 'doubles',
      challenger: lockedPerson, challenger_partner: rest[2],
      opponent: rest[0], opponent_partner: rest[1],
    }
  }

  // Admin mode: randomly assign which pair is challenger
  if (Math.random() > 0.5) {
    return { match_type: 'doubles', challenger: r1, challenger_partner: r4, opponent: r2, opponent_partner: r3 }
  }
  return { match_type: 'doubles', challenger: r2, challenger_partner: r3, opponent: r1, opponent_partner: r4 }
}
