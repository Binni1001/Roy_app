import { initials } from '../../../utils/appUtils'

/* Danh sách chọn người vào pool (có checkbox, hiển thị rank, người bị khoá) */
export function PersonPicker({ people, selected, onToggle, onSelectAll, onClearAll, rankMap, lockedPerson }) {
  return (
    <div className="rm-picker">
      <div className="rm-picker-header">
        <span className="rm-picker-count">{selected.length + (lockedPerson ? 1 : 0)} người trong pool</span>
        <div className="rm-picker-actions">
          <button type="button" className="rm-picker-btn" onClick={onSelectAll}>Chọn tất cả</button>
          <button type="button" className="rm-picker-btn" onClick={onClearAll}>Bỏ chọn</button>
        </div>
      </div>
      <div className="rm-picker-list">
        {lockedPerson && (
          <div className="rm-picker-item rm-picker-locked">
            <div className="rm-picker-avatar">
              {lockedPerson.avatar_url
                ? <img src={lockedPerson.avatar_url} alt={lockedPerson.full_name} className="avatar-img" />
                : <span>{initials(lockedPerson.full_name)}</span>}
            </div>
            <span className="rm-picker-name">{lockedPerson.full_name}</span>
            {rankMap[lockedPerson.id] && rankMap[lockedPerson.id] < 999 && (
              <span className="rm-picker-rank">#{rankMap[lockedPerson.id]}</span>
            )}
            <span className="rm-picker-lock-tag">Bạn</span>
          </div>
        )}
        {people.map((p) => {
          const isSelected = selected.some((s) => s.id === p.id)
          const rank = rankMap[p.id]
          return (
            <label key={p.id} className={`rm-picker-item${isSelected ? ' rm-picker-checked' : ''}`}>
              <input type="checkbox" checked={isSelected} onChange={() => onToggle(p)} />
              <div className="rm-picker-avatar">
                {p.avatar_url
                  ? <img src={p.avatar_url} alt={p.full_name} className="avatar-img" />
                  : <span>{initials(p.full_name)}</span>}
              </div>
              <span className="rm-picker-name">{p.full_name}{p.nickname ? ` · ${p.nickname}` : ''}</span>
              {rank && rank < 999
                ? <span className="rm-picker-rank">#{rank}</span>
                : <span className="rm-picker-rank rm-picker-unranked">–</span>}
            </label>
          )
        })}
      </div>
    </div>
  )
}
