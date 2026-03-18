const { createCanvas } = require('canvas');
const fs = require('fs');

async function createIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Background
  ctx.fillStyle = '#0A0A0F';
  ctx.fillRect(0, 0, size, size);
  
  // Rounded corners clip
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.125);
  ctx.clip();
  
  // Redraw background with rounded corners
  ctx.fillStyle = '#0A0A0F';
  ctx.fillRect(0, 0, size, size);
  
  // Grid pattern - 4 squares
  const pad = size * 0.1875;
  const sq = size * 0.27;
  const gap = size * 0.0625;
  
  // Top-left (filled)
  ctx.fillStyle = '#10B981';
  ctx.fillRect(pad, pad, sq, sq);
  
  // Top-right (outline)
  ctx.strokeStyle = '#10B981';
  ctx.lineWidth = size * 0.02;
  ctx.strokeRect(pad + sq + gap, pad, sq, sq);
  
  // Bottom-left (outline)
  ctx.strokeRect(pad, pad + sq + gap, sq, sq);
  
  // Bottom-right (light outline)
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
  ctx.strokeRect(pad + sq + gap, pad + sq + gap, sq, sq);
  
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(`public/icon-${size}x${size}.png`, buffer);
  console.log(`Created icon-${size}x${size}.png`);
}

async function main() {
  await createIcon(192);
  await createIcon(512);
}

main().catch(console.error);
