import * as Phaser from 'phaser'
import kelpUrl from './kelp_plant_white.png'

export default class BackgroundScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BackgroundScene' })
  }

  preload() {
    this.load.spritesheet('kelp', kelpUrl, {
      frameWidth: 16,
      frameHeight: 16
    })
  }

  create() {
    this.W = this.scale.width
    this.H = this.scale.height

    this.graphics = this.add.graphics()
    this.graphics.setScrollFactor(0)
    this.progress = 0
    this.elapsed = 0

    this.randomSeed = this.getRandomSeed(this.scene.get('GameScene').totalFuel)

    this.anims.create({
      key: 'kelp_sway',
      frames: this.anims.generateFrameNumbers('kelp', { start: 0, end: 19 }),
      frameRate: 6,
      repeat: -1
    })

    this.createSeafloor()
  }

  drawBackground(progress, time) {
    const g = this.graphics
    g.clear()

    const W = this.W
    const H = this.H
    const t = time

    // background gradient bands
    const bands = 20
    for (let i = 0; i < bands; i++) {
      const bt = i / bands
      const depth = 1 - progress * 0.6
      const r  = Math.round(progress * 8  * (1 - bt * 0.4) * depth)
      const gr = Math.round(progress * 20 * (1 - bt * 0.4) * depth)
      const b  = Math.round(progress * 60 * (1 - bt * 0.4) * depth)
      g.fillStyle(Phaser.Display.Color.GetColor(r, gr, b), 1)
      g.fillRect(0, i * (H / bands), W, H / bands + 1)
    }

  }

  seededRandom = (seed) => {
    const x = Math.sin(seed + 1) * 10000
    return x - Math.floor(x)
  }

  getRandomSeed = (totalFuel) => {
    const today = new Date()
    const dateInt = today.getFullYear() * 10000 + today.getMonth() * 100 + today.getDate()
    return dateInt + totalFuel * 17
  }

  createSeafloor() {
    const W = this.scale.width
    const H = this.scale.height

    const generateStalks = (count, seed, minGap = 0.03) => {
      const stalks = []
      let attempts = 0
      while (stalks.length < count && attempts < 200) {
        const val = this.seededRandom(seed + attempts)
        // exclude middle 10%
        if (val >= 0.45 && val <= 0.55) {
          attempts++
          continue
        }
        // check minimum distance from all existing stalks
        const tooClose = stalks.some(s => Math.abs(s - val) < minGap)
        if (!tooClose) {
          stalks.push(val)
        }
        attempts++
      }
      return stalks.sort((a, b) => a - b)
    }
    const layers = [
      { depth: 0.19, tint: 0x333333, floorY: 0.55, bumpH: 0.03, bumps: 1.2, kelp: true, kelpScale: 1.8,
        stalks: generateStalks(5 + Math.floor(this.seededRandom(this.randomSeed + 1) * 4), 1)   // 5-8 stalks
      },
      { depth: 0.3,  tint: 0x777777, floorY: 0.68, bumpH: 0.03, bumps: 1.7, kelp: true, kelpScale: 2.2,
        stalks: generateStalks(6 + Math.floor(this.seededRandom(this.randomSeed + 2) * 4), 50)  // 6-9 stalks
      },
      { depth: 1,    tint: 0xffffff, floorY: 0.70, bumpH: 0.04, bumps: 1.4, kelp: false, kelpScale: 1,
        stalks: []
      },
    ]

    this.kelpSprites = []

    this.seafloorLayers = layers.map((layer) => {
      const g = this.add.graphics()
      this.drawSeafloorLayer(g, layer, W, H)
      return { g, layer }
    })
  }

  drawSeafloorLayer(g, layer, W, H) {
    g.clear()

    const floorY = H * layer.floorY
    const bumpH  = H * layer.bumpH
    const steps  = 80

    g.fillStyle(layer.tint, 1)
    g.beginPath()
    g.moveTo(0, H)

    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * W
      const nx = (i / steps) * Math.PI * 2 * layer.bumps
      const y = floorY
        - Math.sin(nx) * bumpH * 0.6
        - Math.sin(nx * 1.7 + 1.2) * bumpH * 0.4
      g.lineTo(x, y)
    }

    g.lineTo(W, H)
    g.closePath()
    g.fillPath()

    if (layer.kelp) {
      for (let si = 0; si < layer.stalks.length; si++) {
        const xFrac = layer.stalks[si]
        const cx = W * xFrac
        const nx = xFrac * Math.PI * 2 * layer.bumps
        const cy = floorY
          - Math.sin(nx) * bumpH * 0.6
          - Math.sin(nx * 1.7 + 1.2) * bumpH * 0.4
        // random height seeded per stalk position
        const heightSeed = this.seededRandom(cx * 7.7 + layer.depth * 100 + this.randomSeed)
        const numSegments = Math.round(1 + heightSeed * 24) // 6 to 24 segments
        this.drawKelp(cx, cy, numSegments, layer.kelpScale, layer)
      }
    }
  }

  drawKelp(x, baseY, numSegments, scale, layer) {
    const frameH = 16
    const displayH = frameH * scale

    for (let i = 0; i < numSegments; i++) {
      const sprite = this.add.sprite(
        x,
        baseY - i * displayH - displayH / 2,
        'kelp'
      )
      sprite.setScale(scale)
      sprite.setAlpha(1)
      sprite.setTint(layer.tint)
      sprite.setScrollFactor(0, 0)

      this.kelpSprites.push({ sprite, layerDepth: layer.depth })
      sprite._baseY = baseY - i * displayH - displayH / 2
      sprite._depth = layer.depth

      // offset the animation start so they dont all sway in sync
      const frameOffset = Math.floor((x * 3 + i) % 20)
      sprite.play({ key: 'kelp_sway', startFrame: frameOffset })
    }
  }

  update(time) {
    const cam = this.scene.get('GameScene').cameras.main
    const depth = Math.max(-cam.scrollY, 0)
    const progress = 1 - Math.exp(-depth / 600)
    const t = time / 1000

    this.progress = progress
    this.drawBackground(progress, t)

    // manually apply parallax by shifting each layer's y position
    this.seafloorLayers.forEach(({ g, layer }) => {
      g.y = -cam.scrollY * layer.depth
    })

    this.kelpSprites.forEach(({ sprite }) => {
      sprite.y = sprite._baseY + (-cam.scrollY * sprite._depth)
    })
  }
}