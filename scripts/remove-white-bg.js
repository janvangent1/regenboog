/**
 * Removes white/near-white background from class logo JPGs and saves as PNG with transparency.
 * Run from project root: node scripts/remove-white-bg.js
 */
const fs = require('fs');
const path = require('path');

const CLASSES_DIR = path.join(__dirname, '..', 'public', 'assets', 'images', 'classes');
const WHITE_THRESHOLD = 248; // Pixels with R,G,B all >= this become transparent

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.error('Please install sharp: npm install sharp');
    process.exit(1);
  }

  const files = fs.readdirSync(CLASSES_DIR).filter((f) => f.endsWith('.jpg'));
  if (files.length === 0) {
    console.log('No JPG files in', CLASSES_DIR);
    return;
  }

  for (const file of files) {
    const inputPath = path.join(CLASSES_DIR, file);
    const base = file.replace(/\.jpg$/i, '');
    const outputPath = path.join(CLASSES_DIR, base + '.png');
    try {
      const image = sharp(inputPath);
      const { data, info } = await image
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const channels = info.channels || 4;
      for (let i = 0; i < data.length; i += channels) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD) {
          data[i + 3] = 0;
        }
      }

      await sharp(data, {
        raw: {
          width: info.width,
          height: info.height,
          channels: 4,
        },
      })
        .png()
        .toFile(outputPath);

      console.log('OK', base + '.png');
    } catch (err) {
      console.error('FAIL', file, err.message);
    }
  }
}

main();
