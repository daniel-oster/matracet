interface Props {
  onBack: () => void
  eyebrow?: string
  title: string
  right?: React.ReactNode
  progress?: number  // 0-100
}

export default function TopBar({ onBack, eyebrow, title, right, progress }: Props) {
  return (
    <div className="topbar">
      <div className="topbar-row">
        <button className="topbar-back" onClick={onBack} aria-label="Hem">‹</button>
        <div className="topbar-heading">
          {eyebrow && <div className="topbar-eyebrow">{eyebrow}</div>}
          <div className="topbar-title">{title}</div>
        </div>
        {right && <div className="topbar-right">{right}</div>}
      </div>
      {progress != null && (
        <div className="topbar-progress"><div style={{ width: `${progress}%` }} /></div>
      )}
    </div>
  )
}
