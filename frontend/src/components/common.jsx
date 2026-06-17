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

export function StatusLine({ text }) {
  if (!text) return null
  return <div className="toast" role="alert">{text}</div>
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
  return (
    <div className="search-box">
      <span className="search-icon">🔍</span>
      <input
        type="text"
        className="search-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button className="search-clear" onClick={() => onChange('')} type="button">×</button>
      )}
    </div>
  )
}

/** Filter rows by query across given field paths */
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
