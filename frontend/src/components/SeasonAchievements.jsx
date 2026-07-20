import { Flame, Trophy, Zap } from 'lucide-react'
import { EMPTY_SEASON_ACHIEVEMENTS } from '../constants/seasonAchievements'
import { initials } from '../utils/appUtils'

function PlayerStack({ players }) {
  const visiblePlayers = players.slice(0, 3)
  if (visiblePlayers.length === 0) return null

  return (
    <div className="season-honor-avatars" aria-hidden="true">
      {visiblePlayers.map((player) => (
        player.avatar_url
          ? <img key={player.id} src={player.avatar_url} alt="" />
          : <span key={player.id}>{initials(player.full_name)}</span>
      ))}
      {players.length > visiblePlayers.length && <small>+{players.length - visiblePlayers.length}</small>}
    </div>
  )
}

function playerNames(players) {
  if (!players.length) return ''
  const names = players.slice(0, 2).map((player) => player.nickname || player.full_name)
  return players.length > 2 ? `${names.join(', ')} và ${players.length - 2} người khác` : names.join(', ')
}

function HonorItem({ icon: Icon, tone, title, players, detail, emptyText, loading }) {
  return (
    <article className={`season-honor-item season-honor-${tone}${loading ? ' is-loading' : ''}`}>
      <span className="season-honor-icon"><Icon size={18} strokeWidth={2} /></span>
      <div className="season-honor-copy">
        <strong>{title}</strong>
        <span>{loading ? 'Đang cập nhật' : playerNames(players) || emptyText}</span>
        {!loading && players.length > 0 && <small>{detail}</small>}
      </div>
      {!loading && <PlayerStack players={players} />}
    </article>
  )
}

export function SeasonAchievements({ achievements = EMPTY_SEASON_ACHIEVEMENTS, loading = false }) {
  const energetic = achievements.energetic || []
  const winningStreak = achievements.winning_streak || EMPTY_SEASON_ACHIEVEMENTS.winning_streak
  const mostPlayed = achievements.most_played || EMPTY_SEASON_ACHIEVEMENTS.most_played

  return (
    <section className="season-honors" aria-label="Vinh danh mùa giải">
      <div className="season-honors-heading">
        <span>Vinh danh mùa</span>
        <small>Tính từ các trận đã hoàn tất</small>
      </div>
      <div className="season-honors-grid">
        <HonorItem
          icon={Zap}
          tone="active"
          title="Năng nổ"
          players={energetic}
          detail={`${energetic.length} người đạt điều kiện`}
          emptyText="Cần 8 trận trong 3 ngày"
          loading={loading}
        />
        <HonorItem
          icon={Flame}
          tone="streak"
          title="Chuỗi thắng"
          players={winningStreak.players || []}
          detail={`${winningStreak.count} trận liên tiếp`}
          emptyText="Chưa có chuỗi từ 3 trận"
          loading={loading}
        />
        <HonorItem
          icon={Trophy}
          tone="played"
          title="Chơi nhiều nhất"
          players={mostPlayed.players || []}
          detail={`${mostPlayed.count} trận trong mùa`}
          emptyText="Chưa có trận hoàn tất"
          loading={loading}
        />
      </div>
    </section>
  )
}

export function SeasonAchievementMarks({ personId, achievements = EMPTY_SEASON_ACHIEVEMENTS }) {
  const stats = achievements.by_person?.[personId]
  if (!stats) return null

  return (
    <span className="season-achievement-marks">
      {stats.energetic && (
        <span className="season-achievement-mark mark-active" title={`Năng nổ: ${stats.total_matches} trận trong ${stats.play_days} ngày`} aria-label="Năng nổ">
          <Zap size={12} />
        </span>
      )}
      {stats.winning_streak && (
        <span className="season-achievement-mark mark-streak" title={`Chuỗi thắng: ${stats.current_streak} trận liên tiếp`} aria-label="Chuỗi thắng">
          <Flame size={12} />
        </span>
      )}
      {stats.most_played && (
        <span className="season-achievement-mark mark-played" title={`Chơi nhiều nhất mùa: ${stats.total_matches} trận`} aria-label="Chơi nhiều nhất mùa">
          <Trophy size={12} />
        </span>
      )}
    </span>
  )
}
