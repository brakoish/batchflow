const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');

async function createIconFromLogo(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Background - dark
  ctx.fillStyle = '#0A0A0F';
  ctx.fillRect(0, 0, size, size);
  
  // Scale factor for 100x100 viewBox to fit in icon with padding
  const scale = size / 100;
  const pad = 12 * scale;
  const sq = 32 * scale;
  const gap = 12 * scale;
  const r = 8 * scale;
  
  // Helper to draw rounded rect
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  
  // Top-left (filled)
  ctx.fillStyle = '#10B981';
  roundRect(pad, pad, sq, sq, r);
  ctx.fill();
  
  // Top-right (outline)
  ctx.strokeStyle = '#10B981';
  ctx.lineWidth = 3 * scale;
  roundRect(pad + sq + gap, pad, sq, sq, r);
  ctx.stroke();
  
  // Bottom-left (outline)
  roundRect(pad, pad + sq + gap, sq, sq, r);
  ctx.stroke();
  
  // Bottom-right (light outline)
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
  roundRect(pad + sq + gap, pad + sq + gap, sq, sq, r);
  ctx.stroke();
  
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(`public/icon-${size}x${size}.png`, buffer);
  console.log(`Created icon-${size}x${size}.png from logo`);
}

async function main() {
  await createIconFromLogo(192);
  await createIconFromLogo(512);
}

main().catch(console.error);
