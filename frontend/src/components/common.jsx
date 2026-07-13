import { useRef, useState } from 'react'

export function Panel({ title, children, wide = false, action }) {
  return (
    <article className={wide ? 'panel wide' : 'panel'}>
      <div className="panel-header">
        <h2>{title}</h2>
        {action && <div className="panel-header-action">{action}</div>}
      </div>
      {children}
    </article>
  )
}

export function Input({ label, value, onChange, type = 'text', required = false }) {
  return <label>{label}<input type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} required={required} /></label>
}

export function SelectPeople({ people, value, onChange, label = 'Người' }) {
  return (
    <label>
      {label}
      <select value={value || ''} onChange={(event) => onChange(event.target.value)}>
        <option value="">Chọn người</option>
        {people.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
      </select>
    </label>
  )
}

export function ActionGroup({ children }) {
  return <div className="actions">{children}</div>
}

export function StatusLine({ text, type = 'success' }) {
  if (!text) return null
  return <div className={`toast toast-${type}`} role="alert">{text}</div>
}

export function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Đóng">×</button>
        </header>
        {children}
      </section>
    </div>
  )
}

export function ConfirmModal({
  title = 'Xác nhận thao tác',
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  danger = false,
  onConfirm,
  onClose,
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="modal-body">
        <p>{message}</p>
      </div>
      <footer className="modal-actions">
        <button type="button" onClick={onClose}>{cancelText}</button>
        <button type="button" className={danger ? 'danger' : ''} onClick={onConfirm}>{confirmText}</button>
      </footer>
    </Modal>
  )
}

export function SearchBox({ value, onChange, placeholder = 'Tìm kiếm...' }) {
  const [local, setLocal] = useState(value)
  const timer = useRef(null)

  function handleChange(v) {
    setLocal(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onChange(v), 200)
  }

  function handleClear() {
    setLocal('')
    clearTimeout(timer.current)
    onChange('')
  }

  return (
    <div className="search-box">
      <span className="search-icon">🔍</span>
      <input
        type="text"
        className="search-input"
        value={local}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
      />
      {local && (
        <button className="search-clear" onClick={handleClear} type="button">×</button>
      )}
    </div>
  )
}

/* ── Skeleton primitives ── */
function Sk({ w = '100%', h = 14, r = 4, style }) {
  return <div className="sk" style={{ width: w, height: h, borderRadius: r, ...style }} />
}

export function SkeletonTable({ rows = 5, cols = 7 }) {
  return (
    <div className="table-wrap">
      <table className="sk-table">
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              <td><Sk w={28} h={28} r={14} /></td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sk w={32} h={32} r={16} />
                  <Sk w={90} h={13} />
                </div>
              </td>
              {Array.from({ length: cols - 2 }, (_, c) => (
                <td key={c}><Sk w={32} h={13} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function SkeletonMatchCards({ count = 3 }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="sk-match-card">
          <div className="sk-match-header">
            <Sk w={72} h={22} r={10} />
            <Sk w={52} h={22} r={10} />
            <Sk w={80} h={16} style={{ marginLeft: 'auto' }} />
          </div>
          <div className="sk-match-vs">
            <div className="sk-team">
              <Sk w={48} h={48} r={24} />
              <Sk w={70} h={13} />
              <Sk w={44} h={11} />
            </div>
            <Sk w={30} h={22} r={6} />
            <div className="sk-team">
              <Sk w={48} h={48} r={24} />
              <Sk w={70} h={13} />
              <Sk w={44} h={11} />
            </div>
          </div>
        </div>
      ))}
    </>
  )
}

export function SkeletonPlayerGrid({ count = 6 }) {
  return (
    <div className="sk-player-grid">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="sk-player-card">
          <Sk w={64} h={64} r={32} />
          <Sk w={80} h={14} />
          <Sk w={56} h={11} />
          <Sk w={48} h={11} />
        </div>
      ))}
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function filterRows(rows, query, fields) {
  if (!query.trim()) return rows
  const q = query.toLowerCase().trim()
  return rows.filter((row) =>
    fields.some((field) => {
      const val = field.split('.').reduce((o, k) => o?.[k], row)
      return String(val || '').toLowerCase().includes(q)
    })
  )
}

const BADGE_MAP = {
  // Period status
  open:      { label: 'Đang mở',   cls: 'badge-green'  },
  draft:     { label: 'Nháp',      cls: 'badge-gray'   },
  closed:    { label: 'Đã đóng',   cls: 'badge-red'    },
  // Debt status
  paid:      { label: 'Đã đóng',   cls: 'badge-green'  },
  unpaid:    { label: 'Chưa đóng', cls: 'badge-red'    },
  cancelled: { label: 'Đã hủy',    cls: 'badge-gray'   },
  // Member status
  fixed:     { label: 'Cố định',   cls: 'badge-gold'   },
  'drop-in': { label: 'Vãng lai',  cls: 'badge-blue'   },
  guest:     { label: 'Khách',     cls: 'badge-blue'   },
  // Person status
  active:    { label: 'Hoạt động', cls: 'badge-green'  },
  inactive:  { label: 'Đã nghỉ',   cls: 'badge-gray'   },
  // Attendance type
  'fixed-attendance': { label: 'Đánh cố định', cls: 'badge-gold' },
  // Debt type
  monthly_fee:   { label: 'Quỹ tháng',  cls: 'badge-gold' },
  shuttle_extra: { label: 'Tiền cầu',   cls: 'badge-blue' },
  other:         { label: 'Khác',       cls: 'badge-gray' },
  // Fund type
  income:     { label: 'Thu',       cls: 'badge-green'  },
  expense:    { label: 'Chi',       cls: 'badge-red'    },
  refund:     { label: 'Hoàn',      cls: 'badge-yellow' },
  adjustment: { label: 'Điều chỉnh', cls: 'badge-gray'  },
  // Match status
  pending:   { label: 'Chờ',       cls: 'badge-yellow' },
  completed: { label: 'Hoàn thành', cls: 'badge-blue'  },
}

export function StatusBadge({ value }) {
  if (!value) return <span className="badge badge-gray">—</span>
  const def = BADGE_MAP[value] || { label: value, cls: 'badge-gray' }
  return <span className={`badge ${def.cls}`}>{def.label}</span>
}

export function SimpleTable({ rows, columns, actions }) {
  if (!rows.length) return (
    <div className="empty-state">
      <img src="/images/cat-shuttle.jpg" alt="Chưa có dữ liệu" className="empty-state-img" />
      <p className="empty">Chưa có dữ liệu</p>
    </div>
  )
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map(([, label]) => <th key={label}>{label}</th>)}
            {actions && <th>Thao tác</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || index}>
              {columns.map(([key, , formatter]) => (
                <td key={key}>{formatCell(row, key, formatter)}</td>
              ))}
              {actions && <td>{actions(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatCell(row, key, formatter) {
  const value = readCellValue(row, key)
  if (formatter) return formatter(value, row)
  return value || '-'
}

function readCellValue(row, key) {
  return key.split('.').reduce((value, part) => value?.[part], row)
}
