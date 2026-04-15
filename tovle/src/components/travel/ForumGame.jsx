import { useEffect, useRef } from 'react'
import * as Phaser from 'phaser'

const BASE_SPEED = 200
const SPEED_INCREMENT = 15
const MAX_SPEED = 600

//width the game is designed for
//used to scale camera zoom on diff screen sizes
const REFERENCE_WIDTH = 400

if (!document.querySelector('link[href*="Press+Start+2P"]')) {
  const link = document.createElement('link')
  link.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap'
  link.rel = 'stylesheet'
  document.head.appendChild(link)
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
    const t = Math.min(this.blockCount / 30, 1) // 0 to 1 over 30 blocks
    const r = Math.round(255 * (1 - t * 0.8))
    const g = Math.round(255 * (1 - t * 0.6))
    const b = 255
    return Phaser.Display.Color.GetColor(r, g, b)
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
    this.gameOverText.setText(message)
    this.gameOverText.setVisible(true)
    this.xpText.setText(`XP earned: ${this.calculateXP()}`)
    this.xpText.setVisible(true)
    this.time.delayedCall(2000, () => {
      this.onGameEnd(this.calculateXP(), this.blockCount)
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
    const zoom = this.scale.width / REFERENCE_WIDTH
    this.cameras.main.setZoom(zoom)
    this.cameras.main.centerOn(REFERENCE_WIDTH / 2, this.scale.height / zoom / 2)
    const width = this.scale.width / zoom   // = REFERENCE_WIDTH
    const height = this.scale.height / zoom

    this.platform = this.add.rectangle(width/2, height + 120, 100, 400, 0xffffff)
    this.movingBlock = this.add.rectangle(width/3, height - 90, 100, 20, 0xffffff)
    this.blockSpeed = 200
    this.perfectPlaceThreshold = 0.05
    this.shakyPlaceThreshold = 0.4
    this.topBlock = this.platform
    this.blockCount = 0
    this.cameraTargetY = 0
    this.isGameOver = false

    this.gameOverText = this.add.text(this.scale.width / 2, 20, 'Game Over!', {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: '"Press Start 2P"',
      resolution: 1,
    }).setOrigin(0.5).setScrollFactor(0).setVisible(false)

    this.xpText = this.add.text(this.scale.width / 2, 20 + 40, '', {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: '"Press Start 2P"',
      resolution: 1,
    }).setOrigin(0.5).setScrollFactor(0).setVisible(false)

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

      //on a bad cut, shake camera
      const cutRatio = (this.topBlock.width-overlap) / this.topBlock.width
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
      const newY = this.movingBlock.y - 20
      this.movingBlock = this.add.rectangle(-this.topBlock.width/2, newY, this.topBlock.width, 20, this.getBlockColor())
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
    this.movingBlock.x += this.blockSpeed * (delta / 1000)

    const halfWidth = this.movingBlock.width / 2
    const worldWidth = this.cameras.main.width / this.cameras.main.zoom

    if (this.movingBlock.x >= worldWidth - halfWidth) {
      this.movingBlock.x = worldWidth - halfWidth
      this.blockSpeed *= -1
    } else if (this.movingBlock.x <= halfWidth) {
      this.movingBlock.x = halfWidth
      this.blockSpeed *= -1
    }
    this.cameras.main.scrollY += (this.cameraTargetY - this.cameras.main.scrollY) * 0.1
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
      backgroundColor: '#1a1a2e',
      pixelArt: true,
    })

    game.scene.add(
      'GameScene', //key
      GameScene, //scene class
      true, //start immediately
      {totalFuel, itemsPerTap, anchorChance, onGameEnd} //data
    )

    return () => game.destroy(true)
  }, [])

  return <div ref={containerRef} style={{ width: '100%', height: '40vh' }} />
}

export default ForumGame