/**
 * Script to generate PWA icons from SVG logo
 * Run with: npx ts-node scripts/generate-icons.ts
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const LOGO_PATH = path.join(PUBLIC_DIR, 'logo.svg');

// Icon sizes to generate
const ICON_SIZES = [
    { size: 16, name: 'favicon-16x16.png' },
    { size: 32, name: 'favicon-32x32.png' },
    { size: 180, name: 'apple-touch-icon.png' },
    { size: 192, name: 'icon-192.png' },
    { size: 512, name: 'icon-512.png' },
    { size: 192, name: 'icon-maskable-192.png', maskable: true },
    { size: 512, name: 'icon-maskable-512.png', maskable: true },
];

async function generateIcons() {
    console.log('Generating PWA icons...\n');

    // Read SVG file
    const svgBuffer = fs.readFileSync(LOGO_PATH);

    for (const icon of ICON_SIZES) {
        const outputPath = path.join(PUBLIC_DIR, icon.name);

        try {
            if (icon.maskable) {
                // For maskable icons, add extra padding (safe zone is 80% of the icon)
                const padding = Math.round(icon.size * 0.1);
                const innerSize = icon.size - (padding * 2);

                await sharp(svgBuffer)
                    .resize(innerSize, innerSize, { fit: 'contain', background: '#0f172a' })
                    .extend({
                        top: padding,
                        bottom: padding,
                        left: padding,
                        right: padding,
                        background: '#0f172a'
                    })
                    .png()
                    .toFile(outputPath);
            } else {
                await sharp(svgBuffer)
                    .resize(icon.size, icon.size, { fit: 'contain', background: '#0f172a' })
                    .png()
                    .toFile(outputPath);
            }

            console.log(`✓ Generated ${icon.name} (${icon.size}x${icon.size})`);
        } catch (error) {
            console.error(`✗ Failed to generate ${icon.name}:`, error);
        }
    }

    // Generate favicon.ico (multi-size ICO would need additional library)
    // For now, just copy the 32x32 as favicon.ico equivalent
    console.log('\n✓ Icons generated successfully!');
    console.log('\nNote: For favicon.ico, use an online converter or the favicon-32x32.png');
}

generateIcons().catch(console.error);
