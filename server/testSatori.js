import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const fontPath = path.join(__dirname, 'fonts/OpenRunde-Regular.ttf')
const fontData = fs.readFileSync(fontPath)

const svg = await satori(
  {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0e0618',
        color: '#fff',
        fontSize: 48,
        fontFamily: 'Open Runde',
      },
      children: 'Depthsle works! 🌊',
    },
  },
  {
    width: 1200,
    height: 630,
    fonts: [
      {
        name: 'Open Runde',
        data: fontData,
        weight: 400,
        style: 'normal',
      },
    ],
  }
)

const resvg = new Resvg(svg)
const pngData = resvg.render()
const pngBuffer = pngData.asPng()

fs.writeFileSync(path.join(__dirname, 'test_output.png'), pngBuffer)
console.log('Success! Check server/test_output.png')