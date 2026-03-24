import './CacheAnimation.css'
import { useRef } from 'react'
import { ITEM_MAP } from '../data/itemMap'
import chestPng from '../assets/chest.png'
import chestGif from '../assets/chest.gif'

const CHEST_SIZE = 64
const ITEM_SIZE = 28
const TOTAL_BOUNCES = 8
const BOUNCE_DUR = 200
const SETTLE_DUR = 500
const FINAL_SHAKE_DUR = 1000

function easeOut(t) { return 1 - Math.pow(1 - t, 3) }
function easeInOut(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2 }

function runAnimation(stage, chest, items, onComplete, animRef) {
  const W = stage.clientWidth
  const H = stage.clientHeight
  const maxX = W - CHEST_SIZE
  const maxY = H - CHEST_SIZE
  const centerX = (W - CHEST_SIZE) / 2
  const centerY = (H - CHEST_SIZE) / 2

  // reset
  chest.src = chestPng
  chest.style.left = centerX + 'px'
  chest.style.top = centerY + 'px'
  chest.style.transform = 'scale(1) rotate(0deg)'
  chest.style.display = 'block'
  stage.querySelectorAll('.co-item').forEach(e => e.remove())
  stage.querySelectorAll('.co-particle').forEach(e => e.remove())

  const displayItems = items.slice(0, TOTAL_BOUNCES)

  const targets = Array.from({ length: TOTAL_BOUNCES }, (_, i) => {
    const edge = i % 4
    if (edge === 0) return { x: 8, y: 8 + Math.random() * (maxY - 16) }
    if (edge === 1) return { x: maxX - 8, y: 8 + Math.random() * (maxY - 16) }
    if (edge === 2) return { x: 8 + Math.random() * (maxX - 16), y: 8 }
    return { x: 8 + Math.random() * (maxX - 16), y: maxY - 8 }
  })

  const activeItems = []
  let cx = centerX, cy = centerY
  let fromX = cx, fromY = cy
  let toX = targets[0].x, toY = targets[0].y
  let bouncesDone = 0
  let phase = 'bouncing'
  let phaseStart = null
  let lastNow = null

  const spawnParticles = () => {
    // const colors = ['#1abc9c','#3498db','#9b59b6','#f39c12','#e74c3c','#DAA520','#2ecc71','#e67e22']
    const colors = ['#f1f2f3','#f1f2f3','#f1f2f3','#f1f2f3','#f1f2f3','#f1f2f3','#f1f2f3','#f1f2f3']
    colors.forEach((color, i) => {
      const angle = (i / colors.length) * Math.PI * 2
      const p = document.createElement('div')
      p.className = 'co-particle'
      p.style.cssText = `
        position: absolute;
        width: 8px; height: 8px;
        border-radius: 50%;
        background: ${color};
        left: ${centerX + CHEST_SIZE / 2}px;
        top: ${centerY + CHEST_SIZE / 2}px;
        pointer-events: none;
      `
      stage.appendChild(p)
      const dist = 65 + Math.random() * 50
      p.animate([
        { transform: 'translate(-50%,-50%) scale(1.3)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px)) scale(0)`, opacity: 0 }
      ], { duration: 700, easing: 'ease-out', fill: 'forwards' })
        .onfinish = () => p.remove()
    })
  }

  const spawnItem = (index) => {
    const item = displayItems[index]
    const itemDef = item ? ITEM_MAP[item.itemId] : null
    const el = document.createElement('div')
    el.className = 'co-item'
    el.style.cssText = `
      position: absolute;
      width: ${ITEM_SIZE}px; height: ${ITEM_SIZE}px;
      left: ${cx + CHEST_SIZE / 2 - ITEM_SIZE / 2}px;
      top: ${cy + CHEST_SIZE / 2 - ITEM_SIZE / 2}px;
      pointer-events: none;
      display: flex; align-items: center; justify-content: center;
    `
    if (itemDef?.img) {
      const img = document.createElement('img')
      img.src = itemDef.img
      img.style.cssText = `width: ${ITEM_SIZE}px; height: ${ITEM_SIZE}px; image-rendering: pixelated;`
      el.appendChild(img)
    } else {
      el.style.background = '#1abc9c'
      el.style.borderRadius = '50%'
    }
    stage.appendChild(el)
    const speed = 3 + Math.random() * 3
    const angle = Math.random() * Math.PI * 2
    activeItems.push({
      el,
      x: cx + CHEST_SIZE / 2 - ITEM_SIZE / 2,
      y: cy + CHEST_SIZE / 2 - ITEM_SIZE / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      spinSpeed: (Math.random() - 0.5) * 0.3
    })
  }

  const tick = (now) => {
    const dt = lastNow ? Math.min(now - lastNow, 32) : 16
    lastNow = now
    if (!phaseStart) phaseStart = now
    const elapsed = now - phaseStart

    // update bouncing items
    const itemMaxX = W - ITEM_SIZE
    const itemMaxY = H - ITEM_SIZE
    activeItems.forEach(item => {
      item.x += item.vx * (dt / 16)
      item.y += item.vy * (dt / 16)
      if (item.x <= 0) { item.x = 0; item.vx = Math.abs(item.vx) * 0.85 }
      if (item.x >= itemMaxX) { item.x = itemMaxX; item.vx = -Math.abs(item.vx) * 0.85 }
      if (item.y <= 0) { item.y = 0; item.vy = Math.abs(item.vy) * 0.85 }
      if (item.y >= itemMaxY) { item.y = itemMaxY; item.vy = -Math.abs(item.vy) * 0.85 }
      item.vx *= 0.995
      item.vy *= 0.995
      item.el.style.left = item.x + 'px'
      item.el.style.top = item.y + 'px'
      item.el.style.transform = `rotate(${(now * item.spinSpeed) % 360}deg)`
    })

    if (phase === 'bouncing') {
      const t = Math.min(elapsed / BOUNCE_DUR, 1)
      const et = easeOut(t)
      cx = fromX + (toX - fromX) * et
      cy = fromY + (toY - fromY) * et
      const shake = Math.sin(now * 0.05) * 10
      const sy = 1 + Math.abs(Math.sin(now * 0.05)) * 0.12
      chest.style.left = cx + 'px'
      chest.style.top = cy + 'px'
      chest.style.transform = `rotate(${shake}deg) scaleX(${2 - sy}) scaleY(${sy})`

      if (t >= 1) {
        if (bouncesDone < displayItems.length) spawnItem(bouncesDone)
        bouncesDone++
        if (bouncesDone < TOTAL_BOUNCES) {
          fromX = cx; fromY = cy
          toX = targets[bouncesDone].x; toY = targets[bouncesDone].y
          phaseStart = now
        } else {
          phase = 'settling'
          fromX = cx; fromY = cy
          phaseStart = now
        }
      }
      animRef.current = requestAnimationFrame(tick)

    } else if (phase === 'settling') {
      const t = Math.min(elapsed / SETTLE_DUR, 1)
      const et = easeInOut(t)
      cx = fromX + (centerX - fromX) * et
      cy = fromY + (centerY - fromY) * et
      const shake = Math.sin(now * 0.04) * 6 * (1 - t)
      chest.style.left = cx + 'px'
      chest.style.top = cy + 'px'
      chest.style.transform = `rotate(${shake}deg) scale(1)`

      if (t < 1) {
        animRef.current = requestAnimationFrame(tick)
      } else {
        // swap to gif
        chest.src = chestGif + '?t=' + Date.now()
        chest.style.transform = 'scale(1) rotate(0deg)'

        chest.animate([
          { transform: 'rotate(0deg) scale(1)' },
          { transform: 'rotate(-12deg) scale(1.2)' },
          { transform: 'rotate(12deg) scale(1.2)' },
          { transform: 'rotate(-10deg) scale(1.3)' },
          { transform: 'rotate(10deg) scale(1.3)' },
          { transform: 'rotate(0deg) scale(1.4)' },
        ], { duration: FINAL_SHAKE_DUR, easing: 'ease-in-out' }).onfinish = () => {
          spawnParticles()
          chest.style.display = 'none'
          activeItems.forEach(item => {
            item.el.animate(
              [{ opacity: 1 }, { opacity: 0 }],
              { duration: 400, fill: 'forwards' }
            )
          })
          setTimeout(() => onComplete?.(), 500)
        }
      }
    }
  }

  animRef.current = requestAnimationFrame(tick)
}

const CacheAnimation = ({ items = [], onComplete}) => {
  const animRef = useRef(null)
  const startedRef = useRef(false)

  const stageCallback = (stage) => {
    console.log('stageCallback fired', stage ? 'with node' : 'with null')
    if (!stage) {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      startedRef.current = false
      return
    }
    if (startedRef.current) return
    startedRef.current = true

    const chest = stage.querySelector('.co-chest')
    runAnimation(stage, chest, items, onComplete, animRef)
  }

  return (
    <div className="co-stage" ref={stageCallback}>
      <img
        src={chestPng}
        alt="chest"
        className="co-chest"
        style={{ imageRendering: 'pixelated', transformOrigin: 'center 78%' }}
      />
    </div>
  )
}

export default CacheAnimation