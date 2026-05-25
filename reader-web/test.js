import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  await page.goto('http://localhost:5173');
  await page.waitForSelector('.file-list', { timeout: 5000 }).catch(() => {});
  
  await page.evaluate(() => {
     const btns = Array.from(document.querySelectorAll('button'));
     btns.find(b => b.textContent.includes('Library'))?.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  const pdfItem = await page.$('li[data-file-type="pdf"]'); 
  if (pdfItem) await pdfItem.click();

  await new Promise(r => setTimeout(r, 3000));

  await page.evaluate(() => {
    const selects = Array.from(document.querySelectorAll('select'));
    const viewSelect = selects.find(s => s.options[0].text.includes('Single') || s.options[0].text.includes('Scroll'));
    if (viewSelect) {
      viewSelect.value = 'scroll';
      viewSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  await new Promise(r => setTimeout(r, 2000));

  // Add scroll listener to log calculations
  await page.evaluate(() => {
    // Find the container based on overflow
    const container = document.querySelector('div[style*="overflow"]');
    if (!container) return;
    container.addEventListener('scroll', () => {
      const containerRect = container.getBoundingClientRect();
      const topThreshold = containerRect.top + containerRect.height * 0.5;
      let pageAtTop = 1;
      const debugInfo = [];
      
      for (let pageNum = 1; pageNum <= 5; pageNum += 1) {
        const element = document.getElementById('pdf-page-' + pageNum);
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        debugInfo.push('p' + pageNum + ':' + Math.round(rect.top));
        if (rect.top <= topThreshold) {
          pageAtTop = pageNum;
        }
      }
      console.log('SCROLL_DEBUG: scroll=' + Math.round(container.scrollTop) + ' pageAtTop=' + pageAtTop + ' topThreshold=' + Math.round(topThreshold) + ' ' + debugInfo.join(', '));
    });
  });

  await page.evaluate(() => {
    const container = document.querySelector('div[style*="overflow"]');
    if (container) container.scrollTop += 500;
  });
  await new Promise(r => setTimeout(r, 500));
  
  await page.evaluate(() => {
    const container = document.querySelector('div[style*="overflow"]');
    if (container) container.scrollTop += 1500;
  });
  await new Promise(r => setTimeout(r, 1000));

  await browser.close();
})();
