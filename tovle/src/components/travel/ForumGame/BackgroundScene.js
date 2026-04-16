import * as Phaser from 'phaser'

export default class BackgroundScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BackgroundScene' })
  }

  create() {
    this.W = this.scale.width
    this.H = this.scale.height

    this.graphics = this.add.graphics()
    this.graphics.setScrollFactor(0)
    this.progress = 0
    this.elapsed = 0

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

  createSeafloor() {
    const W = this.scale.width
    const H = this.scale.height

    const layers = [
      { depth: 0.18, opacity: 0.15, floorY: 0.55, bumpH: 0.03, bumps: 1.2, color: 0xffffff },
      { depth: 0.3, opacity: 0.35, floorY: 0.68, bumpH: 0.03, bumps: 1.7, color: 0xffffff },
      { depth: 1, opacity: 1, floorY: 0.67, bumpH: 0.04, bumps: 1.9, color: 0xffffff },
    ]

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

    g.fillStyle(layer.color, layer.opacity)
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
  }
}