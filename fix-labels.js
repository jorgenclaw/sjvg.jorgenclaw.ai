const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const labelsDir = '/home/jorgenclaw/sjvg/catalog/labels';
const files = fs.readdirSync(labelsDir).filter(f => f.endsWith('.png'));

async function processLabel(filename) {
  const inputPath = path.join(labelsDir, filename);
  const step1 = inputPath + '.s1.png';
  const step2 = inputPath + '.s2.png';
  const overlayPath = inputPath + '.overlay.png';
  
  // Step 1: Decode PNG to PNG (ensures clean format)
  await sharp(inputPath).png().toFile(step1);
  
  const meta = await sharp(step1).metadata();
  const { width, height } = meta;
  
  console.log(`Decoded ${filename} (${width}x${height})`);
  
  const y = Math.round(height * 0.35);
  const h = Math.round(height * 0.30);
  
  // Create overlay
  const overlayData = Buffer.alloc(width * h * 4);
  const step = Math.round(h / 20);
  
  for (let row = 0; row < h; row++) {
    let opacity;
    if (row < step * 2) opacity = (row / (step * 2)) * 0.35;
    else if (row > h - step * 2) opacity = ((h - row) / (step * 2)) * 0.35;
    else opacity = 0.35;
    
    const r = row * width * 4;
    for (let col = 0; col < width; col++) {
      const idx = r + col * 4;
      overlayData[idx] = 0;
      overlayData[idx + 1] = 0;
      overlayData[idx + 2] = 0;
      overlayData[idx + 3] = Math.round(opacity * 255);
    }
  }
  
  await sharp(Buffer.from(overlayData), {
    raw: { width, height: h, channels: 4 }
  }).png().toFile(overlayPath);
  
  // Step 2: Composite overlay onto step1 output
  await sharp(step1)
    .composite([{
      input: overlayPath,
      top: y,
      left: 0,
      blend: 'multiply'
    }])
    .png()
    .toFile(step2);
  
  // Replace original
  fs.renameSync(step2, inputPath);
  fs.unlinkSync(step1);
  fs.unlinkSync(overlayPath);
  console.log(`Done ${filename}`);
}

(async () => {
  for (const file of files) {
    try {
      await processLabel(file);
    } catch (e) {
      console.error(`FAIL ${file}: ${e.message}`);
    }
  }
})();
