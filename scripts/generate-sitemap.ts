/**
 * Script to generate sitemap.xml for static export
 * Run with: npx tsx scripts/generate-sitemap.ts
 */

import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://rto-codes.in';
const DATA_DIR = path.join(process.cwd(), 'data', 'karnataka');
const PUBLIC_DIR = path.join(process.cwd(), 'public');

function getAllRTOCodes(): string[] {
    const files = fs.readdirSync(DATA_DIR).filter(file => file.endsWith('.json') && file.startsWith('ka-'));
    return files.map(file => file.replace('.json', ''));
}

function generateSitemap() {
    const today = new Date().toISOString().split('T')[0];
    const rtoCodes = getAllRTOCodes();

    const staticPages = [
        { url: '', priority: '1.0', changefreq: 'weekly' },
        { url: '/about', priority: '0.8', changefreq: 'monthly' },
        { url: '/contribute', priority: '0.7', changefreq: 'monthly' },
    ];

    const rtoPages = rtoCodes.map(code => ({
        url: `/rto/${code}`,
        priority: '0.9',
        changefreq: 'monthly',
    }));

    const allPages = [...staticPages, ...rtoPages];

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(page => `  <url>
    <loc>${BASE_URL}${page.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

    const outputPath = path.join(PUBLIC_DIR, 'sitemap.xml');
    fs.writeFileSync(outputPath, sitemap);
    console.log(`✓ Generated sitemap.xml with ${allPages.length} URLs`);
}

generateSitemap();
