import { useEffect, useRef } from 'react'
import * as Phaser from 'phaser'
import { FadeInEffectAction } from '@cloudinary/url-gen/actions/effect/leveled/FadeIn'

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

  calculateXP() {
    const blocksSpent = this.blockCount * this.itemsPerTap
    const heightMultiplier = Math.pow(1 + this.blockCount * 0.15, 2)
    return Math.round(blocksSpent * heightMultiplier)
  }

  preload() {}

  create() {
    // this.add.text(this.scale.width / 2, this.scale.height / 2, 'Phaser is working!', {
    //   fontSize: '20px',
    //   color: '#ffffff',
    // }).setOrigin(0.5)

    this.platform = this.add.rectangle(this.scale.width/2, this.scale.height - 40, 100, 80, 0xffffff)
    this.movingBlock = this.add.rectangle(this.scale.width/3, this.scale.height - 90, 100, 20, 0x4ecdc4)
    this.blockSpeed = 200
    this.topBlock = this.platform
    this.blockCount = 0
    this.cameraTargetY = 0

    this.gameOverText = this.add.text(this.scale.width / 2, 20, 'Game Over!', {
      fontSize: '32px',
      color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setVisible(false)

    this.xpText = this.add.text(this.scale.width / 2, 20 + 40, '', {
      fontSize: '20px',
      color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setVisible(false)

    this.input.on('pointerdown', () => {
      this.blockSpeed = 0
      
      const result = this.getOverlap(this.movingBlock, this.topBlock)
      if (result === null) {
        console.log('game over!!!!!!')
        this.gameOverText.setVisible(true)
        this.xpText.setText(`XP earned: ${this.calculateXP()}`)
        this.xpText.setVisible(true)
        this.time.delayedCall(1500, () => {
          this.onGameEnd(this.calculateXP(), this.blockCount)
        })
      } else {

        const { overlap, newX } = result
        
        //resize placed block
        this.movingBlock.setSize(overlap, 20)
        this.movingBlock.setPosition(newX, this.movingBlock.y)
        this.topBlock = this.movingBlock

        const newY = this.movingBlock.y - 20
        this.movingBlock = this.add.rectangle(-overlap/2, newY, overlap, 20, 0xff6b6b)
        this.blockSpeed = 200

        this.blockCount = this.blockCount + 1
        if (this.blockCount > 5) {
          this.cameraTargetY -= 20
        }

        if (this.blockCount >= this.maxTaps) {
          this.blockSpeed = 0
          this.movingBlock.setSize(0, 20) //make it invisible lol
          this.gameOverText.setText('Out of blocks!')
          this.gameOverText.setVisible(true)
          this.xpText.setText(`XP earned: ${this.calculateXP()}`)
          this.xpText.setVisible(true)
          this.time.delayedCall(1500, () => {
            this.onGameEnd(this.calculateXP(), this.blockCount)
          })
        }
      }


    })
  }

  update(time, delta) {
    this.movingBlock.x += this.blockSpeed * (delta / 1000)

    const halfWidth = this.movingBlock.width / 2
    if (this.movingBlock.x >= this.scale.width - halfWidth) {
      this.movingBlock.x = this.scale.width - halfWidth
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