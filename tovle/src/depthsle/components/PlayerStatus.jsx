import './PlayerStatus.css'

function StatusPip({ status }) {
  const LABELS = {
    stun:     { label: 'STN', color: '#f4c430' },
    root:     { label: 'ROOT', color: '#7ec850' },
    silence:  { label: 'SIL', color: '#a0a0c0' },
    slow:     { label: 'SLW', color: '#60a0d0' },
    burn:     { label: 'BRN', color: '#ff6a00' },
    weakness: { label: 'WKN', color: '#c070e0' },
  }
  const def = LABELS[status.type] ?? { label: status.type.slice(0,3).toUpperCase(), color: '#888' }
  return (
    <span className="ps-pip" style={{ borderColor: def.color, color: def.color }}>
      {def.label}{status.duration !== Infinity ? ` ${status.duration}` : ''}
    </span>
  )
}

function BuffPip({ buff }) {
  return (
    <span className="ps-pip ps-pip--buff">
      {buff.type.replace('_', ' ')} +{buff.value}% ({buff.turnsRemaining}t)
    </span>
  )
}

export default function PlayerStatus({ player }) {
  const hpPct = Math.round((player.hp / player.maxHp) * 100)
  const absPct = player.absorption > 0
    ? Math.round((player.absorption / player.maxHp) * 100)
    : 0

  const hpColor = hpPct > 50 ? 'var(--color-bar-fill)' : hpPct > 25 ? '#e0a030' : '#c04040'

  return (
    <div className="ps-container">

      {/* ── HP row ── */}
      <div className="ps-hp-row">
        <span className="ps-hp-label">
          {player.hp}<span className="ps-hp-max">/{player.maxHp}</span>
          {player.absorption > 0 && (
            <span className="ps-absorption"> +{player.absorption}</span>
          )}
        </span>
        <span className="ps-hp-pct">{hpPct}%</span>
      </div>

      {/* ── HP bar ── */}
      <div className="ps-bar-track">
        <div
          className="ps-bar-fill"
          style={{ width: `${Math.min(hpPct, 100)}%`, background: hpColor }}
        />
        {absPct > 0 && (
          <div
            className="ps-bar-absorption"
            style={{ width: `${Math.min(absPct, 100 - hpPct)}%` }}
          />
        )}
      </div>

      {/* ── Buffs and DoTs ── */}
      {(player.buffs.length > 0 || player.playerDoTs?.length > 0 || player.webbed > 0) && (
        <div className="ps-status-row">
          {player.buffs.map((buff, i) => (
            <BuffPip key={i} buff={buff} />
          ))}
          {player.webbed > 0 && (
            <span className="ps-pip ps-pip--debuff">WEB {player.webbed}t</span>
          )}
          {player.playerDoTs?.map((dot, i) => (
            <span key={i} className="ps-pip ps-pip--debuff">
              {dot.type === 'magic' ? 'PSN' : 'BLD'} {dot.damage}/t ({dot.turnsLeft}t)
            </span>
          ))}
        </div>
      )}

    </div>
  )
}