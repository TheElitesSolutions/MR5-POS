const sharp = require('sharp');
const toIco = require('to-ico');
const fs = require('fs');
const path = require('path');

async function convertLogo() {
  try {
    console.log('Converting The Elites logo PNG to ICO...');

    const pngPath = path.join(__dirname, 'renderer', 'public', 'the-elites-logo.png');
    const icoPath = path.join(__dirname, 'resources', 'icon.ico');

    // Get image metadata to check dimensions
    const metadata = await sharp(pngPath).metadata();
    console.log(`Original dimensions: ${metadata.width}x${metadata.height}`);

    // Create square versions at different sizes for ICO
    const sizes = [256, 128, 64, 48, 32, 16];
    const pngBuffers = [];

    for (const size of sizes) {
      const buffer = await sharp(pngPath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toBuffer();

      pngBuffers.push(buffer);
      console.log(`✓ Created ${size}x${size} version`);
    }

    // Convert to ICO
    const icoBuffer = await toIco(pngBuffers);
    fs.writeFileSync(icoPath, icoBuffer);

    console.log('✓ Successfully converted logo to ICO format');
    console.log(`  Input: ${pngPath}`);
    console.log(`  Output: ${icoPath}`);
    console.log(`  Sizes included: ${sizes.join(', ')}`);
  } catch (error) {
    console.error('Error converting logo:', error);
    process.exit(1);
  }
}

convertLogo();
