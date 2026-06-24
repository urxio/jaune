type ConfirmDeleteProps = {
  onConfirm: () => void
  onCancel: () => void
  label?: string
  confirmColor?: string
  confirmTextColor?: string
}

export default function ConfirmDelete({ onConfirm, onCancel, label = 'Delete?', confirmColor = '#c0392b', confirmTextColor = '#fff' }: ConfirmDeleteProps) {
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <span style={{ fontSize: '11px', color: 'var(--text-2)' }}>{label}</span>
      <button
        onClick={onConfirm}
        style={{ background: confirmColor, color: confirmTextColor, border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
      >
        Yes
      </button>
      <button
        onClick={onCancel}
        style={{ background: 'var(--bg-3)', color: 'var(--text-2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer' }}
      >
        No
      </button>
    </div>
  )
}
