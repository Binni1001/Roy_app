/* ──────────────────────────────────────────────────────────
   Thuật toán xếp lịch đấu cân bằng cho 1 ngày (nhiều trận)

   Mục tiêu:
   1. Số trận mỗi người xấp xỉ bằng nhau (cân bằng số lần ra sân)
   2. Đánh đôi: hạn chế lặp lại cùng cặp đồng đội, phân bổ đối thủ đều
   3. Mỗi trận cân sức (ghép theo rank: mạnh + yếu vs 2 người giữa)
   ────────────────────────────────────────────────────────── */

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const pairKey = (a, b) => [a, b].sort().join('|')

// Lấy `need` người có số lần ra sân thấp nhất; xáo trộn trong nhóm bằng điểm để công bằng
function pickFewestAppearance(pool, appear, need) {
  const sorted = shuffle(pool).sort((a, b) => (appear.get(a.id) || 0) - (appear.get(b.id) || 0))
  return sorted.slice(0, need)
}

function rankOf(rankMap, id) {
  const r = rankMap[id]
  return r && r < 999 ? r : 500
}

// Ghép 1 trận đơn từ 2 người (cân theo rank, random bên thách đấu)
function buildSinglesMatch(a, b) {
  const [c, o] = Math.random() > 0.5 ? [a, b] : [b, a]
  return {
    match_type: 'singles',
    challenger: c,
    opponent: o,
    challenger_partner: null,
    opponent_partner: null,
  }
}

// Từ 4 người, chọn cách chia đội tốt nhất:
// - ít lặp lại cặp đồng đội nhất
// - 2 đội cân sức nhất (chênh tổng rank thấp)
function buildDoublesMatch(four, rankMap, partnerCount) {
  const [p, q, r, s] = four
  // 3 cách chia 4 người thành 2 cặp
  const splits = [
    [[p, q], [r, s]],
    [[p, r], [q, s]],
    [[p, s], [q, r]],
  ]

  let best = null
  let bestScore = Infinity
  for (const [t1, t2] of splits) {
    const dupPenalty =
      (partnerCount.get(pairKey(t1[0].id, t1[1].id)) || 0) +
      (partnerCount.get(pairKey(t2[0].id, t2[1].id)) || 0)
    const sum1 = rankOf(rankMap, t1[0].id) + rankOf(rankMap, t1[1].id)
    const sum2 = rankOf(rankMap, t2[0].id) + rankOf(rankMap, t2[1].id)
    const balance = Math.abs(sum1 - sum2)
    // ưu tiên tránh lặp đồng đội (nặng), rồi mới đến cân sức
    const score = dupPenalty * 1000 + balance + Math.random() * 5
    if (score < bestScore) {
      bestScore = score
      best = [t1, t2]
    }
  }

  const [team1, team2] = best
  const [ch, op] = Math.random() > 0.5 ? [team1, team2] : [team2, team1]
  return {
    match_type: 'doubles',
    challenger: ch[0],
    challenger_partner: ch[1],
    opponent: op[0],
    opponent_partner: op[1],
  }
}

/**
 * Sinh danh sách trận cân bằng.
 * @param {Object[]} pool       Người chơi trong pool
 * @param {number}   count      Số trận muốn tạo
 * @param {'singles'|'doubles'} mode
 * @param {Object}   rankMap    { personId: rank }
 * @returns {Object[]} danh sách match { match_type, challenger, opponent, challenger_partner, opponent_partner }
 */
export function generateSchedule(pool, count, mode, rankMap = {}) {
  const perMatch = mode === 'singles' ? 2 : 4
  if (!Array.isArray(pool) || pool.length < perMatch) return []
  const n = Math.max(1, Math.floor(count))

  const appear = new Map(pool.map((p) => [p.id, 0]))
  const partnerCount = new Map() // cặp đồng đội đã ghép bao nhiêu lần
  const versusKeys = new Set()   // cặp đối đầu đã gặp (để tránh lặp y hệt)

  const matches = []
  let guard = 0

  while (matches.length < n && guard < n * 40) {
    guard++
    const picked = pickFewestAppearance(pool, appear, perMatch)
    if (picked.length < perMatch) break

    let match
    if (mode === 'singles') {
      match = buildSinglesMatch(picked[0], picked[1])
    } else {
      match = buildDoublesMatch(picked, rankMap, partnerCount)
    }

    // Tránh lặp y hệt trận liền trước (cùng tập người chơi) nếu pool đủ đa dạng
    const sig = [match.challenger, match.opponent, match.challenger_partner, match.opponent_partner]
      .filter(Boolean).map((p) => p.id).sort().join('|')
    const prev = matches[matches.length - 1]
    if (prev) {
      const prevSig = [prev.challenger, prev.opponent, prev.challenger_partner, prev.opponent_partner]
        .filter(Boolean).map((p) => p.id).sort().join('|')
      // chỉ né nếu còn dư người để ghép khác
      if (sig === prevSig && pool.length > perMatch) continue
    }

    // Ghi nhận
    const ids = [match.challenger, match.opponent, match.challenger_partner, match.opponent_partner].filter(Boolean)
    ids.forEach((p) => appear.set(p.id, (appear.get(p.id) || 0) + 1))
    if (mode === 'doubles') {
      partnerCount.set(pairKey(match.challenger.id, match.challenger_partner.id),
        (partnerCount.get(pairKey(match.challenger.id, match.challenger_partner.id)) || 0) + 1)
      partnerCount.set(pairKey(match.opponent.id, match.opponent_partner.id),
        (partnerCount.get(pairKey(match.opponent.id, match.opponent_partner.id)) || 0) + 1)
    }
    versusKeys.add(sig)

    matches.push(match)
  }

  return matches
}

/** Thống kê số lần ra sân của mỗi người trong lịch — để hiển thị độ cân bằng */
export function appearanceStats(matches) {
  const counts = new Map()
  matches.forEach((m) => {
    [m.challenger, m.opponent, m.challenger_partner, m.opponent_partner]
      .filter(Boolean)
      .forEach((p) => {
        const cur = counts.get(p.id) || { person: p, count: 0 }
        cur.count++
        counts.set(p.id, cur)
      })
  })
  return [...counts.values()].sort((a, b) => b.count - a.count)
}
