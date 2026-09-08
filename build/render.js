const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--font-render-hinting=none']
  });
  // A4 @96dpi = 794px; content column = 794 - (15mm*2) = ~681px.
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await page.emulateMedia({ media: 'print' });
  await page.goto('file:///home/user/flerwa/build/blueprint.html', { waitUntil: 'load' });

  // Auto-fit: shrink any <pre> or <table> that overflows its column, rather than
  // shrinking every block to fit the single widest one.
  const fitted = await page.evaluate(() => {
    const report = { pre: 0, table: 0 };
    const fit = (el, startPt, minPt, kind) => {
      let size = startPt;
      el.style.fontSize = size + 'pt';
      let guard = 0;
      while (el.scrollWidth > el.clientWidth + 1 && size > minPt && guard++ < 60) {
        size -= 0.25;
        el.style.fontSize = size + 'pt';
      }
      if (size < startPt) report[kind]++;
    };
    document.querySelectorAll('pre').forEach(el => fit(el, 8, 5.6, 'pre'));
    document.querySelectorAll('table').forEach(el => {
      const w = el.parentElement.clientWidth;
      let size = 8.5;
      el.style.fontSize = size + 'pt';
      let guard = 0;
      while (el.scrollWidth > w + 1 && size > 5.8 && guard++ < 60) {
        size -= 0.25;
        el.style.fontSize = size + 'pt';
      }
      if (size < 8.5) report.table++;
    });
    return report;
  });

  await page.pdf({
    path: '/home/user/flerwa/Trusted-Services-Marketplace-Blueprint.pdf',
    format: 'A4',
    tagged: true,
    outline: true,
    printBackground: true,
    displayHeaderFooter: true,
    margin: { top: '16mm', bottom: '20mm', left: '15mm', right: '15mm' },
    headerTemplate: '<div></div>',
    footerTemplate: `
      <div style="width:100%;font-family:'DejaVu Sans',Helvetica,sans-serif;font-size:7.5pt;
                  color:#7b858e;padding:0 15mm;display:flex;justify-content:space-between;">
        <span>Trusted Services Marketplace · Kenya · Strategic Blueprint</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>`
  });

  console.log('auto-fitted blocks →', JSON.stringify(fitted));
  await browser.close();
})();
