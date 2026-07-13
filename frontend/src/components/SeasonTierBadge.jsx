const SEASON_TIERS = [
  { key: 'champion', label: 'Thách đấu', image: '/images/ranks/champion.webp', range: 'Hạng 1' },
  { key: 'diamond', label: 'Kim cương', image: '/images/ranks/diamond.webp', range: 'Nhóm dẫn đầu' },
  { key: 'platinum', label: 'Bạch kim', image: '/images/ranks/platinum.webp', range: 'Nhóm xếp hạng cao' },
  { key: 'gold', label: 'Vàng', image: '/images/ranks/gold.webp', range: 'Nhóm giữa trên' },
  { key: 'silver', label: 'Bạc', image: '/images/ranks/silver.webp', range: 'Nhóm giữa dưới' },
  { key: 'bronze', label: 'Đồng', image: '/images/ranks/bronze.webp', range: 'Nhóm còn lại' },
]

const TIERS_BY_KEY = Object.fromEntries(SEASON_TIERS.map((tier) => [tier.key, tier]))

export function SeasonTierBadge({ tierKey, showLabel = true }) {
  const tier = TIERS_BY_KEY[tierKey] || TIERS_BY_KEY.bronze

  return (
    <span
      className={`lb-tier-badge lb-tier-${tier.key}`}
      title={tier.label}
      aria-label={showLabel ? undefined : tier.label}
    >
      <img className="lb-tier-image" src={tier.image} alt="" aria-hidden="true" />
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
