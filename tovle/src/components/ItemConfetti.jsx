import { useEffect, useState } from 'react'
import { ITEM_MAP } from '../data/itemMap'
import './ItemConfetti.css'

const CONFETTI_ITEMS = [
  ITEM_MAP.hyperexperience,
  ITEM_MAP.hypercrystalline_shard,
  ITEM_MAP.prismarine_crystals,
  ITEM_MAP.prismarine_shard,
  ITEM_MAP.pulsating_emerald,
]

const randomBetween = (min, max) => min + Math.random() * (max - min)

const generateItems = () => {
  return Array.from({ length: 28 }, (_, i) => ({
    id: i,
    item: CONFETTI_ITEMS[Math.floor(Math.random() * CONFETTI_ITEMS.length)],
    x: randomBetween(0, 100),           // % across screen
    duration: randomBetween(1.8, 3.2),  // fall speed
    delay: randomBetween(0, 1.5),       // stagger
    rotation: randomBetween(-360, 360), // end rotation
    size: Math.floor(randomBetween(18, 28)), // px
  }))
}

const ItemConfetti = ({ onComplete }) => {
  const [items] = useState(generateItems)

  // call onComplete after the longest possible animation finishes
  // max duration 3.2 + max delay 1.5 = 4.7s, round up to 5s
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.()
    }, 5000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="confetti-overlay">
      {items.map(item => (
        <img
          key={item.id}
          src={item.item.img}
          className="confetti-item"
          style={{
            left: `${item.x}%`,
            width: `${item.size}px`,
            height: `${item.size}px`,
            animationDuration: `${item.duration}s`,
            animationDelay: `${item.delay}s`,
            '--rotation': `${item.rotation}deg`,
          }}
        />
      ))}
    </div>
  )
}

export default ItemConfetti