const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const CARD_WIDTH = 600;
const CARD_HEIGHT = 1050;

async function convertSvgToPng(browser, svgFile, pngFile) {
  const page = await browser.newPage();
  
  try {
    const svgContent = fs.readFileSync(svgFile, 'utf8');
    
    const html = `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; }
  body { width: ${CARD_WIDTH}px; height: ${CARD_HEIGHT}px; overflow: hidden; }
  svg { display: block; }
</style>
</head>
<body>${svgContent}</body>
</html>`;
    
    await page.setViewport({ 
      width: CARD_WIDTH, 
      height: CARD_HEIGHT,
      deviceScaleFactor: 2 
    });
    
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    
    // Wait for images to load
    await page.evaluate(() => {
      return Promise.all(
        Array.from(document.querySelectorAll('image')).map(img => {
          if (img.href?.baseVal) {
            return new Promise((resolve) => {
              const testImg = new Image();
              testImg.onload = resolve;
              testImg.onerror = resolve;
              testImg.src = img.href.baseVal;
            });
          }
          return Promise.resolve();
        })
      );
    });
    
    await page.screenshot({ 
      path: pngFile, 
      type: 'png',
      clip: { x: 0, y: 0, width: CARD_WIDTH, height: CARD_HEIGHT }
    });
    
    console.log(`  ✓ ${path.basename(svgFile)} → ${path.basename(pngFile)}`);
    
  } catch (err) {
    console.error(`  ✗ ${path.basename(svgFile)}: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function main() {
  // Find all card SVGs that don't have a corresponding PNG
  const svgFiles = fs.readdirSync('.')
    .filter(f => f.startsWith('card_') && f.endsWith('.svg'));
  
  const toConvert = svgFiles.filter(svg => {
    const png = svg.replace('.svg', '.png');
    if (!fs.existsSync(png)) return true;
    // Also reconvert if SVG is newer than PNG
    const svgStat = fs.statSync(svg);
    const pngStat = fs.statSync(png);
    return svgStat.mtimeMs > pngStat.mtimeMs;
  });
  
  if (toConvert.length === 0) {
    console.log('No new SVGs to convert.');
    return;
  }
  
  console.log(`Converting ${toConvert.length} SVG(s) to PNG...`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  for (const svgFile of toConvert) {
    const pngFile = svgFile.replace('.svg', '.png');
    await convertSvgToPng(browser, svgFile, pngFile);
  }
  
  await browser.close();
  console.log('Done.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
