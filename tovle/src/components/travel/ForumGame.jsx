import { useEffect, useRef } from 'react'
import * as Phaser from 'phaser'

import BackgroundScene from './ForumGame/BackgroundScene'

const BASE_SPEED = 200
const SPEED_INCREMENT = 15
const MAX_SPEED = 600

// if (!document.querySelector('link[href*="Press+Start+2P"]')) {
//   const link = document.createElement('link')
//   link.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap'
//   link.rel = 'stylesheet'
//   document.head.appendChild(link)
// }

// if (!document.querySelector('link[href*="Tiny5"]')) {
//   const link = document.createElement('link')
//   link.href = 'https://fonts.googleapis.com/css2?family=Tiny5&display=swap'
//   link.rel = 'stylesheet'
//   document.head.appendChild(link)
// }

if (!document.querySelector('link[href*="Jersey+15"]')) {
  const link = document.createElement('link')
  link.href = 'https://fonts.googleapis.com/css2?family=Jersey+15&display=swap'
  link.rel = 'stylesheet'
  document.head.appendChild(link)
}

class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' })
  }

  create() {
    const dpr = window.devicePixelRatio || 1

    const scale = this.scale.width / 400
    const gameOverSize = Math.round(30 * scale)
    const xpSize = Math.round(30 * scale)

    this.gameOverText = this.add.text(this.scale.width / 2, this.scale.height / 3, 'Game Over!', {
      fontSize: `${gameOverSize}px`,
      color: '#ffffff',
      fontFamily: '"Jersey 15"',
      resolution: dpr,
    }).setOrigin(0.5).setVisible(false)

    this.xpText = this.add.text(10,0, '', {
      fontSize: `${xpSize}px`,
      color: '#ffffff',
      fontFamily: '"Jersey 15"',
      resolution: dpr,
    }).setVisible(false)

    this.debugText = this.add.text(10,40, '', {
      fontSize: `${xpSize}px`,
      color: '#ffffff',
      fontFamily: '"Jersey 15"',
      resolution: dpr,
    }).setVisible(false)

    // listen for game over event from GameScene
    this.scene.get('GameScene').events.on('gameover', ({ message, xp }) => {
      this.gameOverText.setText(message)
      this.gameOverText.setVisible(true)
      this.xpText.setText(`XP earned: ${xp}`)
      this.xpText.setVisible(true)
    })
  }

  update() {
    const game = this.scene.get('GameScene')
    const fps = Math.round(this.game.loop.actualFps)
    this.debugText.setText(`${this.scale.width}x${this.scale.height} blocks:${game.blockCount} fps:${fps}`)
    this.debugText.setVisible(false)
    // this.xpText.setText(`XP earned: ${game.calculateXP()}`)
    // this.xpText.setVisible(true)
  }
}

class GameScene extends Phaser.Scene {

  constructor() {
    super('GameScene')
  }

  init(data) {
    this.itemsPerTap = data.itemsPerTap
    this.anchorChance = data.anchorChance
    this.totalFuel = data.totalFuel
    this.onGameEnd = data.onGameEnd
    this.maxTaps = Math.floor(data.totalFuel / data.itemsPerTap)
  }

  getOverlap(blockA, blockB) {
    const leftA = blockA.x - blockA.width/2
    const rightA = blockA.x + blockA.width/2
    const leftB = blockB.x - blockB.width/2
    const rightB = blockB.x + blockB.width/2
    const overlap = Math.min(rightA, rightB) - Math.max(leftA, leftB)
    if (overlap <= 0) {
      return null
    }
    const newX = Math.max(leftA, leftB) + overlap/2
    return {overlap, newX}
  }

  getBlockColor() {
    this.colorProgress = Math.min(this.colorProgress + 1/15, 1)
    
    if (this.colorProgress >= 1) {
      // roll new target, old target becomes new start
      this.blockColorStart = { ...this.blockColorTarget }
      this.blockColorTarget = this.randomColorTarget()
      this.colorProgress = 0
    }

    const t = this.colorProgress
    const r = Math.round(this.blockColorStart.r + (this.blockColorTarget.r - this.blockColorStart.r) * t)
    const g = Math.round(this.blockColorStart.g + (this.blockColorTarget.g - this.blockColorStart.g) * t)
    const b = Math.round(this.blockColorStart.b + (this.blockColorTarget.b - this.blockColorStart.b) * t)
    return Phaser.Display.Color.GetColor(r, g, b)
  }

  randomColorTarget() {
    //pastel ish lighter colors
    const r = 180 + Math.floor(Math.random() * 75)
    const g = 180 + Math.floor(Math.random() * 75)
    const b = 180 + Math.floor(Math.random() * 75)
    // bias one channel higher to give it a hue
    const channel = Math.floor(Math.random() * 3)
    const boost = [r, g, b]
    boost[channel] = 255
    // and drop one channel to make the hue more distinct
    const drop = (channel + 1 + Math.floor(Math.random() * 2)) % 3
    boost[drop] = 120 + Math.floor(Math.random() * 60)
    return { r: boost[0], g: boost[1], b: boost[2] }
  }

  calculateXP() {
    const blocksSpent = this.blockCount * this.itemsPerTap
    const heightMultiplier = Math.pow(1 + this.blockCount * 0.15, 2)
    const limiter = 100
    const xp = blocksSpent * heightMultiplier / limiter
    return Math.round(xp * 10) / 10 //nearest tens place
  }

  handleGameOver(message = "Game Over!") {
    this.isGameOver = true
    this.blockSpeed = 0

    this.events.emit('gameover', { message, xp: this.calculateXP() })

    this.time.delayedCall(2000, () => {
      this.onGameEnd(this.calculateXP(), this.blockCount)
    })
  }

  spawnDebris(x, y, width, color, direction) {
    const debris = this.add.rectangle(x,y,width,20,color)
    this.physics.add.existing(debris)
    debris.body.setVelocityX(direction * (60 + Math.random() * 60))
    debris.body.setVelocityY(-60 + Math.random() * -80) // slight upward kick then falls
    debris.body.setAngularVelocity((Math.random() - 0.5) * 300)

    // fade out after a moment
    this.tweens.add({
      targets: debris,
      alpha: 0,
      delay: 600,
      duration: 400,
      onComplete: () => debris.destroy()
    })
  }

  triggerAnchor(block, targetWidth, color) {
    // const growAmount = Math.max(10, block.width * 0.1) // 10% or 10px minimum
    // const targetWidth = block.width + growAmount

    // tint it to signal anchor
    // darken the color by 30%
    const r = Math.round(((color >> 16) & 0xff) * 0.8)
    const g = Math.round(((color >> 8)  & 0xff) * 0.95)
    const b = Math.round(((color)       & 0xff) * 0.8)
    const darkColor = Phaser.Display.Color.GetColor(r, g, b)
    block.setFillStyle(darkColor)

    const proxy = { width: block.width }
    this.tweens.add({
      targets: proxy,
      width: targetWidth,
      duration: 500,
      ease: 'Back.Out', // slight overshoot feels satisfying
      onUpdate: () => {
        block.setSize(proxy.width, 20)
        block.setPosition(block.x, block.y) // keep centered
      }
    })
  }

  preload() {
    const g = this.make.graphics({ x: 0, y: 0, add: false })
    g.fillStyle(0xffffff)
    g.fillRect(0, 0, 8, 1)
    g.generateTexture('particle', 8, 1)
    g.destroy()
  }

  create() {
    const W = 400
    const H = 300
    const zoom = this.scale.width / 400
    this.cameras.main.setZoom(zoom)
    this.cameras.main.centerOn(W / 2, H / 2)
    this.cameraTargetY = this.cameras.main.scrollY - (40 / zoom)
    
    this.platform = this.add.rectangle(W / 2, H + 120, 100, 400, 0xffffff)
    this.movingBlock = this.add.rectangle(W / 4, H - 90, 100, 20, 0xffffff)

    this.blockColorStart = { r: 255, g: 255, b: 255 }
    this.blockColorTarget = this.randomColorTarget()
    this.colorProgress = 0

    this.blockSpeed = BASE_SPEED
    this.perfectPlaceThreshold = 0.05
    this.shakyPlaceThreshold = 0.4
    this.anchorChance = 1
    this.topBlock = this.platform
    this.blockCount = 0
    this.isGameOver = false
    
    this.particlesLeft = this.add.particles(0, 0, 'particle', {
      speed: { start: 120, end: 40 },
      angle: { min: 180, max: 180 },
      scale: { start: 2, end: 1 },
      rotate: { min: 270, max: 270 },
      lifespan: 800,
      emitting: false
    })

    this.particlesRight = this.add.particles(0, 0, 'particle', {
      speed: { start: 120, end: 40 },
      angle: { min: 0, max: 0 },
      scale: { start: 2, end: 1 },
      rotate: { min: 90, max: 90 },
      lifespan: 800,
      emitting: false
    })
    

    this.input.on('pointerdown', () => {
      if (this.isGameOver) return
      this.blockSpeed = 0
      
      const result = this.getOverlap(this.movingBlock, this.topBlock)
      if (result === null) {
        this.handleGameOver('Game Over!')
        return
      }

      const { overlap, newX } = result
      const cutRatio = (this.topBlock.width-overlap) / this.topBlock.width

      //throw debris
      const cutWidth = this.movingBlock.width - overlap
      if (cutWidth > 4 && cutRatio > this.perfectPlaceThreshold) { //cant be tiny
        const movingLeft  = this.movingBlock.x - this.movingBlock.width / 2
        const movingRight = this.movingBlock.x + this.movingBlock.width / 2
        const topLeft     = this.topBlock.x - this.topBlock.width / 2
        const topRight    = this.topBlock.x + this.topBlock.width / 2

        // the trimmed piece is on whichever side of the moving block sticks out
        const debrisX = movingLeft < topLeft
          ? movingLeft + cutWidth / 2   // trimmed from the left side
          : movingRight - cutWidth / 2  // trimmed from the right side

        const debrisDirection = movingLeft < topLeft ? -1 : 1
        this.spawnDebris(debrisX, this.movingBlock.y, cutWidth, this.movingBlock.fillColor, debrisDirection)
      }

      //on a bad cut, shake camera
      if (cutRatio > this.shakyPlaceThreshold) {
        this.cameras.main.shake(500, 0.0025, true)
      }
      //particles on a good cut
      if (cutRatio < this.perfectPlaceThreshold ) {
        // this.particles.emitParticleAt(newX, this.movingBlock.y, 12)
        const leftEdge = newX - overlap / 2.4
        const rightEdge = newX + overlap / 2.4
        this.particlesLeft.emitParticleAt(leftEdge, this.movingBlock.y, 1)
        this.particlesRight.emitParticleAt(rightEdge, this.movingBlock.y, 1)
      }
      
      //resize placed block
      //on a perfect cut, keep size
      if (cutRatio < this.perfectPlaceThreshold ) {
        // this.movingBlock.setSize(overlap, 20)
        this.movingBlock.setPosition(this.topBlock.x, this.movingBlock.y)
      } else {
        this.movingBlock.setSize(overlap, 20)
        this.movingBlock.setPosition(newX, this.movingBlock.y)
      }
      
      //move to next block
      this.topBlock = this.movingBlock

      //use nextWidth to handle changes andhoring make to width
      let nextWidth = this.topBlock.width
      if (Math.random() < this.anchorChance) {
        const growAmount = Math.max(10, this.topBlock.width * 0.2)
        nextWidth = this.topBlock.width + growAmount
        this.triggerAnchor(this.topBlock, nextWidth, this.topBlock.fillColor)
      }

      //limit width to max 300
      nextWidth = Math.min(300, nextWidth)
      const newY = this.topBlock.y - 20
      this.movingBlock = this.add.rectangle(-nextWidth/2, newY, nextWidth, 20, this.getBlockColor())
      const direction = this.blockSpeed > 0 ? 1 : -1
      this.blockSpeed = direction * Math.min(BASE_SPEED + this.blockCount * SPEED_INCREMENT, MAX_SPEED)

      this.blockCount = this.blockCount + 1
      if (this.blockCount > 5) {
        this.cameraTargetY -= 20
      }
      if (this.blockCount >= this.maxTaps) {
        this.movingBlock.setSize(0, 20) //make it invisible lol
        this.handleGameOver('Out of blocks!')
      }

    })
  }

  update(time, delta) {
    //moving block back and forth
    const currentZoom = this.cameras.main.zoom
    const visibleHalfW = (this.scale.width / currentZoom) / 2
    const worldLeft  = 200 - visibleHalfW
    const worldRight = 200 + visibleHalfW

    this.movingBlock.x += this.blockSpeed * (delta / 1000)
    const halfWidth = this.movingBlock.width / 2
    if (this.movingBlock.x >= worldRight - halfWidth) {
      this.movingBlock.x = worldRight - halfWidth
      this.blockSpeed *= -1
    } else if (this.movingBlock.x <= worldLeft + halfWidth) {
      this.movingBlock.x = worldLeft + halfWidth
      this.blockSpeed *= -1
    }

    //move camera up as tower grows
    this.cameras.main.scrollY += (this.cameraTargetY - this.cameras.main.scrollY) * 0.1

    //camera zoom out if blocks get larger than standard
    const centerX = 200 // fixed world center, never changes
    const blockLeft  = this.topBlock.x - this.topBlock.width / 2
    const blockRight = this.topBlock.x + this.topBlock.width / 2
    const farthestEdge = Math.max(Math.abs(blockLeft - centerX), Math.abs(blockRight - centerX))

    const baseZoom = this.scale.width / 400
    const targetZoom = baseZoom * (100 / Math.max(farthestEdge, 100))
    const clampedZoom = Math.min(targetZoom, baseZoom)
    this.cameras.main.setZoom(this.cameras.main.zoom + (clampedZoom - this.cameras.main.zoom) * 0.05)
  }
}

const ForumGame = ({totalFuel, itemsPerTap, anchorChance, onGameEnd}) => {
  const containerRef = useRef(null)

  useEffect(() => {
    console.log('Game starting with:', { totalFuel, itemsPerTap, anchorChance, onGameEnd })

    const width = containerRef.current.offsetWidth
    const height = containerRef.current.offsetHeight

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width,
      height,
      parent: containerRef.current,
      // backgroundColor: '#1a1a2e',
      pixelArt: true,
      resolution: window.devicePixelRatio,
      physics: {
        default: 'arcade',
        arcade: { gravity: { y: 400 }, debug: false },
      },
    })

    game.scene.add('BackgroundScene', BackgroundScene, true)
    game.scene.add(
      'GameScene', //key
      GameScene, //scene class
      true, //start immediately
      {totalFuel, itemsPerTap, anchorChance, onGameEnd} //data
    )
    game.scene.add('UIScene', UIScene, true)

    return () => game.destroy(true)
  }, [])

  // return <div ref={containerRef} style={{ width: '400px', height: '500px', margin: '0 auto' }} />
  return (
    <div style={{ width: '100%', margin: '0 auto', aspectRatio: '4/3' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

export default ForumGame