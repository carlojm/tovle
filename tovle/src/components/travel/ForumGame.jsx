import { useEffect, useRef } from 'react'
import * as Phaser from 'phaser'

import BackgroundScene from './ForumGame/BackgroundScene'
import bubbleUrl from './ForumGame/bubble.png'
import bubblepopUrl from './ForumGame/bubblepop.png'


const BASE_SPEED = 200
// const SPEED_EXPONENT = 1.15
const MAX_SPEED = 100000

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

  playOutro(currency) {
    const W = this.scale.width
    const H = this.scale.height

    const wave = this.add.graphics()
    wave.setDepth(999)

    const progress = { y: H + 40, time: 0 }

    this.tweens.add({
      targets: progress,
      y: -40,
      time: 3, // time advances alongside y
      duration: 1200,
      ease: 'Sine.InOut',
      onUpdate: () => {
        wave.clear()
        wave.fillStyle(0x0a1628, 1)

        const steps = 40
        const amplitude = 20

        wave.beginPath()
        wave.moveTo(0, progress.y)

        for (let i = 0; i <= steps; i++) {
          const x = (i / steps) * W
          const y = progress.y
            + Math.sin((i / steps) * Math.PI * 4 - progress.time * 6) * amplitude
            + Math.sin((i / steps) * Math.PI * 2 - progress.time * 4) * amplitude * 0.5
          wave.lineTo(x, y)
        }

        wave.lineTo(W, H + 40)
        wave.lineTo(0, H + 40)
        wave.closePath()
        wave.fillPath()
      },
      onComplete: () => {
        this.time.delayedCall(400, () => {
          const gameScene = this.scene.get('GameScene')
          const adjustedBlocks = Math.floor(gameScene.blockCount * (1 - gameScene.fuelSaver))
          gameScene.onGameEnd(currency, gameScene.blockCount, adjustedBlocks)
        })
      }
    })
  }

  spawnBubble(screenX, screenY, quadrant) {
    const image = this.add.image(screenX, screenY, 'bubble')
    image.setDisplaySize(56, 56)

    const bubble = {image, screenX, screenY, tapsRemaining: 3, quadrant}
    this.activeBubbles.push(bubble)

    image.setScale(0)
      this.tweens.add({
      targets: image,
      scaleX: 56 / image.width,
      scaleY: 56 / image.height,
      duration: 250,
      ease: 'Back.Out',
    })

    return bubble
  }

  popBubble (bubble) {
    this.activeBubbles = this.activeBubbles.filter(b => b !== bubble)
    bubble.image.setTexture('bubblepop')
    bubble.image.setDisplaySize(72,72)

    this.tweens.add({
      targets: bubble.image,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration: 200,
      ease: 'Sine.In',
      onComplete: () => bubble.image.destroy()
    })
  }

  preload() {
    this.load.image('bubble', bubbleUrl)
    this.load.image('bubblepop', bubblepopUrl)
  }

  create() {
    this.activeBubbles = []

    const dpr = window.devicePixelRatio || 1
    const scale = this.scale.width / 400
    const gameOverSize = Math.round(30 * scale)
    const xpSize = Math.round(30 * scale)

    document.fonts.load('1px "Jersey 15"').then(() => {
      this.gameOverText = this.add.text(this.scale.width / 2, this.scale.height / 3, 'Game Over!', {
        fontSize: `${gameOverSize}px`,
        color: '#ffffff',
        fontFamily: '"Jersey 15"',
        resolution: dpr,
      }).setOrigin(0.5).setVisible(false)

      this.crystalText = this.add.text(10, 0, '', {
        fontSize: `${xpSize}px`,
        color: '#ffffff',
        fontFamily: '"Jersey 15"',
        resolution: dpr,
      }).setVisible(false)

      this.shardText = this.add.text(10, xpSize + 5, '', {
        fontSize: `${xpSize}px`,
        color: '#ffffff',
        fontFamily: '"Jersey 15"',
        resolution: dpr,
      }).setVisible(false)

      this.debugText = this.add.text(10, 40, '', {
        fontSize: `${xpSize}px`,
        color: '#ffffff',
        fontFamily: '"Jersey 15"',
        resolution: dpr,
      }).setVisible(false)

      // move event listeners inside here too so they can reference the text objects
      this.scene.get('GameScene').events.on('gameover', ({ message, currency }) => {
        this.gameOverText.setText(message)
        this.gameOverText.setVisible(true)

        const { crystals, featCrystals, shards, featShards } = currency
        const totalShards = Math.round((shards + featShards) * 10) / 10

        const crystalLine = featCrystals > 0
          ? `Crystals earned ${crystals} + ${featCrystals}`
          : `Crystals earned ${crystals}`
        this.crystalText.setText(crystalLine)
        this.crystalText.setVisible(true)

        if (totalShards > 0) {
          const shardLine = featShards > 0
            ? `Shards earned ${shards} + ${featShards}`
            : `Shards earned ${totalShards}`
          this.shardText.setText(shardLine)
          this.shardText.setVisible(true)
        }
      })

      this.scene.get('GameScene').events.on('outro', ({ currency }) => {
        this.playOutro(currency)
      })
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

    //skill tree
    //theres gotta be a better way to do this... but.. this is fine
    //doing them one by one like this is at least helping me keep track of what's implemented
    this.anchorChance = data.anchorChance
    this.speedExponent = data.speedExponent ?? 1.15
    this.perfectPlacementUnlocked = data.perfectPlacementUnlocked ?? false
    this.perfectThreshold = data.perfectThreshold ?? 0.05
    this.startingWidth = data.startingWidth ?? 100
    this.crystalMultiplier = data.crystalMultiplier ?? 1
    this.anchorUnlocked = data.anchorUnlocked ?? false
    this.reviveUnlocked = data.reviveUnlocked ?? false
    this.perfectAnchorUnlocked = data.perfectAnchorUnlocked ?? false
    this.perfectAnchorChance = data.perfectAnchorChance ?? 0
    this.perfectAnchorGrowthFactor = data.perfectAnchorGrowthFactor ?? 0.1

    this.activeCrystalGain = data.activeCrystalGain ?? 0
    this.activeShardGain = data.activeShardGain ?? 0
    this.shardPassiveGain = data.shardPassiveGain ?? 0

    this.bubblesUnlocked = data.bubblesUnlocked ?? false
    this.bubbleChance = data.bubbleChance ?? 0
    this.bubbleAmount = data.bubbleAmount ?? 1
    this.critChainChance = data.critChainChance ?? 0
    this.critAnchorUnlocked = data.critAnchorUnlocked ?? false
    this.critAnchorChance = data.critAnchorChance ?? 0
    this.critAnchorGrowth = data.critAnchorGrowth ?? 0

    this.fuelSaver = data.fuelSaver ?? 0
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

  // calculateXP() {
  //   const blocksSpent = this.blockCount * this.itemsPerTap
  //   const heightMultiplier = Math.pow(1 + this.blockCount * 0.15, 2)
  //   const limiter = 100
  //   const xp = blocksSpent * heightMultiplier * this.crystalMultiplier / limiter
  //   return Math.round(xp * 10) / 10 //nearest tens place
  // }

  calculateCurrency() {
    //height based (passive) crystal/shard gain
    const blocksSpent = this.blockCount * this.itemsPerTap
    const heightMultiplier = Math.pow(1 + this.blockCount * 0.15, 2)
    const limiter = 100
    const crystals = Math.round(blocksSpent * heightMultiplier * this.crystalMultiplier / limiter * 10) / 10
    const shards = Math.round(blocksSpent * heightMultiplier * this.shardPassiveGain / limiter * 10) / 10

    //feat based (active) crystal/shard gain
    let featCrystals = 0
    let featShards = 0
    for (let i=0; i < this.featCount; i++) {
      const roll = 0.5 + Math.random() //0.5 to 1.5 random multiplier
      const roll2 = 0.5 + Math.random()
      featCrystals += this.activeCrystalGain * roll / 2 //rate limits for balancing
      featShards += this.activeShardGain * roll2 / 8 //ill keep messing with these til it feels right...
    }
    featCrystals = Math.round(featCrystals * 10) / 10
    featShards = Math.round(featShards * 10) / 10

    return {
      crystals, featCrystals, shards, featShards,
      //more returns for stat tracking
      anchors: this.anchorCount,
      perfects: this.perfectCount,
      crits: this.critCount,
     }
  }

  handleGameOver(message = "Game Over!") {
    if (this.reviveUnlocked && !this.hasRevived) {
      this.triggerRevive()
      return
    }

    this.isGameOver = true
    this.blockSpeed = 0
    const currency = this.calculateCurrency()

    this.events.emit('gameover', { message, currency })

    this.time.delayedCall(500, () => {
      this.events.emit('outro', { currency })
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
    // tint it to signal anchor
    // darken the color by 30%
    const r = Math.round(((color >> 16) & 0xff) * 0.9)
    const g = Math.round(((color >> 8)  & 0xff) * 0.9)
    const b = Math.round(((color)       & 0xff) * 0.9)
    const darkColor = Phaser.Display.Color.GetColor(r, g, b)
    block.setFillStyle(darkColor)

    //particles
    const leftEdge  = block.x - targetWidth / 2
    const rightEdge = block.x + targetWidth / 2
    this.diagEmitters[0].emitParticleAt(leftEdge,  block.y, 1) // 135
    this.diagEmitters[1].emitParticleAt(rightEdge, block.y, 1) // 45

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

  triggerRevive() {
    this.hasRevived = true
    const reviveWidth = Math.max(this.topBlock.width, this.startingWidth * 0.5)

    //grow/shrink last block
    const proxy = { width: this.topBlock.width }
    this.tweens.add({
      targets: proxy,
      width: reviveWidth,
      duration: 400,
      ease: 'Sine.Out',
      onUpdate: () => {
        this.topBlock.setSize(proxy.width, 20)
        this.topBlock.setPosition(this.topBlock.x, this.topBlock.y)
      }
    })

    // flash the top block white to signal the revival
    this.topBlock.setFillStyle(0xffffff)

    // spawn new moving block at revive width
    const currentZoom = this.cameras.main.zoom
    const visibleHalfW = (this.scale.width / currentZoom) / 2
    const spawnX = (200 - visibleHalfW) - reviveWidth / 2
    const newY = this.topBlock.y - 20

    //destroy mid air block that caused miss
    this.spawnDebris(this.movingBlock.x, this.movingBlock.y, this.movingBlock.width, this.movingBlock.fillColor, 1)
    this.movingBlock.destroy()

    this.movingBlock = this.add.rectangle(spawnX, newY, reviveWidth, 20, this.getBlockColor())

    this.reviveSpeedDampen = 8 //drop speed back to what it was, like, 6 blocks ago
    this.blockSpeed = Math.min(
      BASE_SPEED * Math.pow(this.speedExponent, Math.max(0, this.blockCount - this.reviveSpeedDampen)),
      MAX_SPEED
    )
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
    
    this.platform = this.add.rectangle(W / 2, H + 120, this.startingWidth, 400, 0xffffff)
    this.movingBlock = this.add.rectangle(W / 4, H - 90, this.startingWidth, 20, 0xffffff)

    this.blockColorStart = { r: 255, g: 255, b: 255 }
    this.blockColorTarget = this.randomColorTarget()
    this.colorProgress = 0

    this.blockSpeed = BASE_SPEED
    this.perfectPlaceThreshold = this.perfectThreshold //from skill tree
    this.shakyPlaceThreshold = 0.4
    if (this.anchorUnlocked === false) {
      this.anchorChance = 0
    }
    this.topBlock = this.platform
    this.blockCount = 0
    this.isGameOver = false
    this.hasRevived = false
    this.reviveSpeedDampen = 0
    this.featCount = 0 //"feats" = anchors, perfects, crits..
    this.critChainActive = false

    //stat trackers
    this.anchorCount = 0
    this.perfectCount = 0
    this.critCount = 0

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

    const diagAngles = [135, 45]
    this.diagEmitters = diagAngles.map(angle => 
      this.add.particles(0, 0, 'particle', {
        speed: { start: 120, end: 40 },
        angle: { min: angle, max: angle },
        scale: { start: 2, end: 1 },
        rotate: { min: angle +90, max: angle+90 },
        lifespan: 800,
        emitting: false
      })
    )
    

    this.input.on('pointerdown', () => {
      if (this.isGameOver) return
      this.blockSpeed = 0

      //crit detection, check if tap overlapped an active bubble
      const uiScene = this.scene.get('UIScene')
      const ptr = this.input.activePointer
      const HIT_RADIUS = 36
      let isCrit = false
      uiScene.activeBubbles.slice().forEach(bubble => {
        const dx = ptr.x - bubble.screenX
        const dy = ptr.y - bubble.screenY
        if (Math.sqrt(dx * dx + dy * dy) < HIT_RADIUS) {
          uiScene.popBubble(bubble)
          this.featCount += 2 //2 instead of 1 to encourage popping bubbles
          this.critChainActive = true
          isCrit = true //dont do logic for crit anchor yet, handle it later
          this.critCount++
        }
      })
      
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

      if (cutRatio < this.perfectPlaceThreshold && this.perfectPlacementUnlocked) {
        //check if perfect place is unlocked in skill tree
        //if unlocked, platform doesn't shrink on perfect place
        this.movingBlock.setPosition(this.topBlock.x, this.movingBlock.y)
        this.featCount++
        this.perfectCount++
      } else {
        this.movingBlock.setSize(overlap, 20)
        this.movingBlock.setPosition(newX, this.movingBlock.y)
      }
      
      //move to next block
      this.topBlock = this.movingBlock

      //use nextWidth to handle changes andhoring make to width
      let nextWidth = this.topBlock.width

      const isPerfect = cutRatio < this.perfectPlaceThreshold
      let anchorTriggered = false

      //normal anchor: preserves width, does not grow
      if (!isPerfect && Math.random() < this.anchorChance) {
        anchorTriggered = true
        // this.triggerAnchor(this.topBlock, nextWidth, this.topBlock.fillColor)
        this.featCount++
        this.anchorCount++
      }

      // perfect anchor: only triggers on a perfect placement, grows
      if (isPerfect && this.perfectAnchorUnlocked && Math.random() < this.perfectAnchorChance + this.anchorChance) {
        const growAmount = Math.min(50, Math.max(10, this.topBlock.width * this.perfectAnchorGrowthFactor))
        nextWidth = this.topBlock.width + growAmount
        anchorTriggered = true
        // this.triggerAnchor(this.topBlock, nextWidth, this.topBlock.fillColor)
        this.featCount++
        this.anchorCount++
      }

      //crit anchor
      if (isCrit && this.critAnchorUnlocked && Math.random() < this.critAnchorChance + this.anchorChance) {
        const growAmount = Math.min(50, Math.max(10, this.topBlock.width * this.critAnchorGrowth))
        nextWidth = this.topBlock.width + growAmount
        anchorTriggered = true
        // this.triggerAnchor(this.topBlock, nextWidth, this.topBlock.fillColor)
        this.featCount++
        this.anchorCount++
      }

      //limit width to max 300
      nextWidth = Math.min(300, nextWidth)

      //perform anchor
      if (anchorTriggered) {
        this.triggerAnchor(this.topBlock, nextWidth, this.topBlock.fillColor)
      }

      //calculate where to start block based on zoom
      const currentZoom = this.cameras.main.zoom
      const visibleHalfW = (this.scale.width / currentZoom) / 2
      const spawnX = (200 - visibleHalfW) - nextWidth / 2 // just off the left edge

      //spawn new block
      const newY = this.topBlock.y - 20
      this.movingBlock = this.add.rectangle(spawnX, newY, nextWidth, 20, this.getBlockColor())
      const direction = this.blockSpeed > 0 ? 1 : -1
      this.blockSpeed = direction * Math.min(
        BASE_SPEED * Math.pow(this.speedExponent, Math.max(0, this.blockCount - this.reviveSpeedDampen)),
        MAX_SPEED
      )

      this.blockCount = this.blockCount + 1
      if (this.blockCount > 5) {
        this.cameraTargetY -= 20
      }
      if (this.blockCount >= this.maxTaps) {
        this.movingBlock.setSize(0, 20) //make it invisible lol
        this.handleGameOver('Out of blocks!')
      }


      //tick down time on all active bubbles
      uiScene.activeBubbles.slice().forEach(bubble => {
        bubble.tapsRemaining--
        //shrink slightly
        const scale = (bubble.tapsRemaining / 3) * (56 / bubble.image.width)
        this.tweens.add({
          targets: bubble.image,
          scaleX: scale,
          scaleY: scale,
          duration: 150,
          ease: 'Sine.Out',
        })
        if (bubble.tapsRemaining <= 0) {
          uiScene.popBubble(bubble)
        }
      })

      //spawn new bubbles
      if (this.bubblesUnlocked) {
        const spawnChance = this.critChainActive
          ? this.bubbleChance + this.critChainChance
          : this.bubbleChance
        this.critChainActive = false //TODO is this how i should keep the chain chance

        //spawn in one of four spots on screen
        if (Math.random() < spawnChance && uiScene.activeBubbles.length < this.bubbleAmount) {
          const W = this.scale.width
          const H = this.scale.height
          const quadrants = [
            { x: W * 0.25, y: H * 0.25 },
            { x: W * 0.75, y: H * 0.25 },
            { x: W * 0.25, y: H * 0.75 },
            { x: W * 0.75, y: H * 0.75 },
          ]
          // filter out quadrants already occupied
          const occupied = uiScene.activeBubbles.map(b => b.quadrant)
          const available = quadrants.filter((_, i) => !occupied.includes(i))
          if (available.length > 0) {
            const pick = available[Math.floor(Math.random() * available.length)]
            const quadrantIndex = quadrants.indexOf(pick)
            const randomX = (Math.random() - 0.5) * W * 0.2
            const randomY = (Math.random() - 0.5) * H * 0.2
            uiScene.spawnBubble(pick.x + randomX, pick.y + randomY, quadrantIndex)
            // uiScene.spawnBubble(pick.x, pick.y)
          }
        }
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

const ForumGame = ({
  totalFuel, itemsPerTap, anchorChance, onGameEnd,
  speedExponent,
  perfectPlacementUnlocked,
  perfectThreshold,
  startingWidth,
  crystalMultiplier,
  anchorUnlocked,
  reviveUnlocked,
  perfectAnchorUnlocked,
  perfectAnchorChance,
  perfectAnchorGrowthFactor,
  activeCrystalGain, activeShardGain, shardPassiveGain,
  bubblesUnlocked, bubbleChance, bubbleAmount,
  critChainChance, critAnchorUnlocked, critAnchorChance, critAnchorGrowth,
  fuelSaver,
}) => {
  const containerRef = useRef(null)

  useEffect(() => {
    console.log('Game starting with:', { totalFuel, itemsPerTap, anchorChance, onGameEnd,
      speedExponent,
      perfectPlacementUnlocked,
      perfectThreshold,
      startingWidth,
      crystalMultiplier,
      anchorUnlocked,
      reviveUnlocked,
      perfectAnchorUnlocked,
      perfectAnchorChance,
      perfectAnchorGrowthFactor,
      activeCrystalGain, activeShardGain, shardPassiveGain,
      bubblesUnlocked, bubbleChance, bubbleAmount,
      critChainChance, critAnchorUnlocked, critAnchorChance, critAnchorGrowth,
      fuelSaver,
    })

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
      {
        totalFuel, itemsPerTap, anchorChance, onGameEnd,
        speedExponent,
        perfectPlacementUnlocked,
        perfectThreshold,
        startingWidth,
        crystalMultiplier,
        anchorUnlocked,
        reviveUnlocked,
        perfectAnchorUnlocked,
        perfectAnchorChance,
        perfectAnchorGrowthFactor,
        activeCrystalGain,
        activeShardGain, 
        shardPassiveGain,
        bubblesUnlocked, bubbleChance, bubbleAmount,
        critChainChance, critAnchorUnlocked, critAnchorChance, critAnchorGrowth,
        fuelSaver,
      } //data
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