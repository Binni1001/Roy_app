import { Crown, Gem, Shield, ShieldCheck, Sparkles, Star } from 'lucide-react'

const SEASON_TIERS = [
  { key: 'champion', label: 'Thách đấu', Icon: Crown, range: 'Hạng 1' },
  { key: 'diamond', label: 'Kim cương', Icon: Gem, range: 'Nhóm dẫn đầu' },
  { key: 'platinum', label: 'Bạch kim', Icon: Sparkles, range: 'Nhóm xếp hạng cao' },
  { key: 'gold', label: 'Vàng', Icon: Star, range: 'Nhóm giữa trên' },
  { key: 'silver', label: 'Bạc', Icon: ShieldCheck, range: 'Nhóm giữa dưới' },
  { key: 'bronze', label: 'Đồng', Icon: Shield, range: 'Nhóm còn lại' },
]

const TIERS_BY_KEY = Object.fromEntries(SEASON_TIERS.map((tier) => [tier.key, tier]))

export function SeasonTierBadge({ tierKey, showLabel = true }) {
  const tier = TIERS_BY_KEY[tierKey] || TIERS_BY_KEY.bronze
  const { Icon } = tier

  return (
    <span
      className={`lb-tier-badge lb-tier-${tier.key}`}
      title={tier.label}
      aria-label={showLabel ? undefined : tier.label}
    >
      <span className="lb-tier-emblem" aria-hidden="true">
        <span className="lb-tier-emblem-core">
          <Icon size={18} strokeWidth={2.2} />
        </span>
      </span>
      {showLabel && <span className="lb-tier-name">{tier.label}</span>}
    </span>
  )
}

export function SeasonTierGuide() {
  return (
    <div className="rg-rules">
      {SEASON_TIERS.map((tier) => (
        <div className="rg-rule rg-tier-rule" key={tier.key}>
          <SeasonTierBadge tierKey={tier.key} showLabel />
          <span>{tier.range}</span>
        </div>
      ))}
    </div>
  )
}
