const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const labelsDir = '/home/jorgenclaw/sjvg/catalog/labels';
const files = fs.readdirSync(labelsDir).filter(f => f.endsWith('.png'));

async function processLabel(filename) {
  const inputPath = path.join(labelsDir, filename);
  const tempPath = inputPath + '.tmp.png';
  
  // First, decode to RGBA
  const rgbaBuffer = await sharp(inputPath).toFormat('jpeg', { quality: 95 }).toBuffer();
  
  const metadata = await sharp(rgbaBuffer).metadata();
  const { width, height } = metadata;
  
  // Create a dark overlay for the text region (middle 30% of height)
  const y = Math.round(height * 0.35);
  const h = Math.round(height * 0.30);
  
  const overlayData = Buffer.alloc(width * h * 4);
  const step = Math.round(h / 20);
  
  for (let row = 0; row < h; row++) {
    let opacity;
    if (row < step * 2) {
      opacity = (row / (step * 2)) * 0.35;
    } else if (row > h - step * 2) {
      opacity = ((h - row) / (step * 2)) * 0.35;
    } else {
      opacity = 0.35;
    }
    
    const r = row * width * 4;
    for (let col = 0; col < width; col++) {
      const idx = r + col * 4;
      overlayData[idx] = 0;
      overlayData[idx + 1] = 0;
      overlayData[idx + 2] = 0;
      overlayData[idx + 3] = Math.round(opacity * 255);
    }
  }
  
  const overlay = sharp(Buffer.from(overlayData), {
    raw: { width, height: h, channels: 4 }
  });
  
  await sharp(rgbaBuffer)
    .composite([
      {
        input: await overlay.toBuffer(),
        top: y,
        left: 0,
        blend: 'multiply'
      }
    ])
    .png()
    .toFile(tempPath);
  
  fs.renameSync(tempPath, inputPath);
  
  console.log(`Processed ${filename} (${width}x${height})`);
}

(async () => {
  for (const file of files) {
    try {
      await processLabel(file);
    } catch (err) {
      console.error(`Error processing ${file}:`, err.message);
    }
  }
  console.log('Done - all labels processed');
})();
