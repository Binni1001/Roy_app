import { useState, useEffect, useRef } from 'react'
import { initials } from '../../../utils/appUtils'
import { shuffle } from './matchmakerUtils'

/* Ô hiển thị 1 người chơi — có hiệu ứng quay slot machine khi spinning=true */
export function PlayerSlot({ person, spinning, spinPool }) {
  const [display, setDisplay] = useState(person)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!spinning) {
      clearInterval(intervalRef.current)
      return
    }
    if (spinPool.length === 0) return
    const pool = shuffle(spinPool)
    let i = 0
    intervalRef.current = setInterval(() => {
      setDisplay(pool[i % pool.length])
      i++
    }, 80)
    return () => clearInterval(intervalRef.current)
  }, [spinning, spinPool])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!spinning && person) setDisplay(person)
  }, [spinning, person])

  return (
    <div className={`rm-slot${spinning ? ' rm-spinning' : ' rm-landed'}`}>
      {display?.avatar_url
        ? <img src={display.avatar_url} alt={display?.full_name} className="rm-slot-avatar avatar-img" />
        : <div className="rm-slot-avatar rm-avatar-initials">{initials(display?.full_name || '?')}</div>}
      <span className="rm-slot-name">{display?.full_name || '?'}</span>
    </div>
  )
}
