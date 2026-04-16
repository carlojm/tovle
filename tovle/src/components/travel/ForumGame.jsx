import { useEffect, useRef } from 'react'
import * as Phaser from 'phaser'

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
    this.gameOverText = this.add.text(this.scale.width / 2, 40, 'Game Over!', {
      fontSize: '45px',
      color: '#ffffff',
      fontFamily: '"Jersey 15"',
    }).setOrigin(0.5).setVisible(false)

    this.xpText = this.add.text(this.scale.width / 2, 90, '', {
      fontSize: '30px',
      color: '#ffffff',
      fontFamily: '"Jersey 15"',
    }).setOrigin(0.5).setVisible(false)

    this.debugText = this.add.text(10,10, '', {
      fontSize: `30px`,
      color: '#ffffff',
      fontFamily: '"Jersey 15"',
      // resolution: 1,
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
    this.debugText.setText(`${this.scale.width}x${this.scale.height} blocks:${game.blockCount}`)
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

    this.blockSpeed = BASE_SPEED
    this.perfectPlaceThreshold = 0.05
    this.shakyPlaceThreshold = 0.4
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
    if (this.movingBlock.x >= 400 - halfWidth) {
      this.movingBlock.x = 400 - halfWidth
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
      physics: {
        default: 'arcade',
        arcade: { gravity: { y: 400 }, debug: false },
      },
    })

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