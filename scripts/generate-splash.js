/* eslint-disable */
// Generates iOS PWA splash screens (apple-touch-startup-image).
// Renders BatchFlow icon centered on a dark background matching the theme.
// Output: public/splash/<width>x<height>.png

const fs = require('fs')
const path = require('path')
const { createCanvas, loadImage } = require('canvas')

const BG = '#0A0A0F' // matches manifest background_color + theme_color
const ICON_PATH = path.join(__dirname, '..', 'public', 'icon-512x512.png')
const OUT_DIR = path.join(__dirname, '..', 'public', 'splash')

// Apple recommended splash dimensions for iPhone + iPad PWAs.
// Each entry is the DEVICE PIXEL size (device width * DPR, device height * DPR)
// and the matching media query for the <link> tag.
const SIZES = [
  // iPhone 14 Pro Max / 15 Pro Max / 16 Pro Max
  { w: 1320, h: 2868, mw: 440, mh: 956, dpr: 3, orient: 'portrait' },
  // iPhone 14 Pro / 15 Pro / 16 Pro
  { w: 1206, h: 2622, mw: 402, mh: 874, dpr: 3, orient: 'portrait' },
  // iPhone 13 Pro Max / 14 Plus
  { w: 1290, h: 2796, mw: 430, mh: 932, dpr: 3, orient: 'portrait' },
  // iPhone 13 / 13 Pro / 14
  { w: 1170, h: 2532, mw: 390, mh: 844, dpr: 3, orient: 'portrait' },
  // iPhone 11 Pro Max / XS Max
  { w: 1242, h: 2688, mw: 414, mh: 896, dpr: 3, orient: 'portrait' },
  // iPhone 11 / XR
  { w: 828, h: 1792, mw: 414, mh: 896, dpr: 2, orient: 'portrait' },
  // iPhone 11 Pro / XS / X
  { w: 1125, h: 2436, mw: 375, mh: 812, dpr: 3, orient: 'portrait' },
  // iPhone 8 Plus / 7 Plus / 6s Plus
  { w: 1242, h: 2208, mw: 414, mh: 736, dpr: 3, orient: 'portrait' },
  // iPhone 8 / 7 / 6s / SE 2nd gen
  { w: 750, h: 1334, mw: 375, mh: 667, dpr: 2, orient: 'portrait' },
  // iPhone SE 1st gen
  { w: 640, h: 1136, mw: 320, mh: 568, dpr: 2, orient: 'portrait' },
  // iPad Pro 12.9"
  { w: 2048, h: 2732, mw: 1024, mh: 1366, dpr: 2, orient: 'portrait' },
  // iPad Pro 11" / iPad Air
  { w: 1668, h: 2388, mw: 834, mh: 1194, dpr: 2, orient: 'portrait' },
  // iPad 10.5"
  { w: 1668, h: 2224, mw: 834, mh: 1112, dpr: 2, orient: 'portrait' },
  // iPad Mini / iPad
  { w: 1536, h: 2048, mw: 768, mh: 1024, dpr: 2, orient: 'portrait' },
]

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })
  const icon = await loadImage(ICON_PATH)

  const tags = []

  for (const s of SIZES) {
    const canvas = createCanvas(s.w, s.h)
    const ctx = canvas.getContext('2d')

    // Background
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, s.w, s.h)

    // Icon: ~22% of the shorter dimension, centered
    const iconSize = Math.round(Math.min(s.w, s.h) * 0.22)
    const iconX = Math.round((s.w - iconSize) / 2)
    const iconY = Math.round((s.h - iconSize) / 2)
    ctx.drawImage(icon, iconX, iconY, iconSize, iconSize)

    const filename = `${s.w}x${s.h}.png`
    fs.writeFileSync(path.join(OUT_DIR, filename), canvas.toBuffer('image/png'))

    const media = `(device-width: ${s.mw}px) and (device-height: ${s.mh}px) and (-webkit-device-pixel-ratio: ${s.dpr}) and (orientation: ${s.orient})`
    tags.push(`<link rel="apple-touch-startup-image" href="/splash/${filename}" media="${media}" />`)

    console.log(`✓ ${filename}`)
  }

  console.log('\n--- paste these into <head> ---\n')
  console.log(tags.join('\n'))
}

main().catch(err => { console.error(err); process.exit(1) })
