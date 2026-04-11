const sharp = require('sharp');
const path = require('path');

const src = path.resolve(__dirname, '../public/Logo2.png');
const outDir = path.resolve(__dirname, '../public/icons');
const bg = { r: 255, g: 255, b: 255, alpha: 1 };

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function run() {
  for (const size of sizes) {
    await sharp(src)
      .resize(size, size, { fit: 'contain', background: bg })
      .png()
      .toFile(path.join(outDir, `icon-${size}x${size}.png`));
    console.log(`✓ icon-${size}x${size}.png`);
  }

  // Apple Touch Icon (180x180)
  await sharp(src)
    .resize(180, 180, { fit: 'contain', background: bg })
    .png()
    .toFile(path.resolve(__dirname, '../public/apple-touch-icon.png'));
  console.log('✓ apple-touch-icon.png (180x180)');

  // Favicon (32x32 como PNG — Next.js lo sirve directamente)
  await sharp(src)
    .resize(32, 32, { fit: 'contain', background: bg })
    .png()
    .toFile(path.resolve(__dirname, '../public/favicon.png'));
  console.log('✓ favicon.png (32x32)');

  console.log('\nTodos los íconos generados correctamente.');
}

run().catch((err) => {
  console.error('Error generando íconos:', err);
  process.exit(1);
});
