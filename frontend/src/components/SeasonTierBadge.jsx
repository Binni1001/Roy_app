import { Crown, Gem, Shield, Sparkles, Star } from 'lucide-react'

const SEASON_TIERS = [
  { key: 'champion', label: 'Nhà vô địch', Icon: Crown, range: 'Hạng 1' },
  { key: 'diamond', label: 'Kim cương', Icon: Gem, range: 'Nhóm 15% dẫn đầu sau hạng 1' },
  { key: 'platinum', label: 'Bạch kim', Icon: Sparkles, range: 'Nhóm 15% - 35%' },
  { key: 'gold', label: 'Vàng', Icon: Star, range: 'Nhóm 35% - 60%' },
  { key: 'silver', label: 'Bạc', Icon: Shield, range: 'Nhóm 60% - 85%' },
  { key: 'bronze', label: 'Đồng', Icon: Shield, range: 'Nhóm còn lại' },
]

const TIERS_BY_KEY = Object.fromEntries(SEASON_TIERS.map((tier) => [tier.key, tier]))

export function SeasonTierBadge({ tierKey, showLabel = true }) {
  const tier = TIERS_BY_KEY[tierKey] || TIERS_BY_KEY.bronze
  const { Icon } = tier

  return (
    <span className={`lb-tier-badge lb-tier-${tier.key}`} title={tier.label}>
      <span className="lb-tier-emblem" aria-hidden="true">
        <Icon size={15} strokeWidth={2.4} />
      </span>
      {showLabel && <span className="lb-tier-name">{tier.label}</span>}
    </span>
  )
}

export function SeasonTierLegend() {
  return (
    <div className="lb-tier-legend-list">
      {SEASON_TIERS.map((tier) => (
        <SeasonTierBadge key={tier.key} tierKey={tier.key} />
      ))}
    </div>
  )
}

export function SeasonTierGuide() {
  return (
    <div className="rg-rules">
      {SEASON_TIERS.map((tier) => (
        <div className="rg-rule rg-tier-rule" key={tier.key}>
          <SeasonTierBadge tierKey={tier.key} />
          <span>{tier.range}</span>
        </div>
      ))}
    </div>
  )
}
