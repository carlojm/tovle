import { usePlayer } from '../context/PlayerContext'

export default function Depthsle() {
  const { playerData } = usePlayer()

  return (
    <div style={{ color: 'var(--color-text)', padding: 24, textAlign: 'center' }}>
      <p>Depthsle coming soon</p>
    </div>
  )
}