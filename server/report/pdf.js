// توليد PDF من JSON النتائج عبر قالب الطباعة ومحرك Chromium الخاص بـ Playwright (page.pdf).
// لا لقطات شاشة ولا تصوير لواجهة التطبيق: المستند يُبنى من البيانات مباشرة.
import { chromium } from 'playwright';
import { config } from '../config.js';
import { renderReport, headerTemplate, footerTemplate, formatDate } from './template.js';

export async function generatePdf(result) {
  const browser = await chromium.launch({ headless: true, executablePath: config.chromiumPath });
  try {
    const page = await browser.newPage();
    await page.setContent(renderReport(result), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: headerTemplate(result),
      footerTemplate: footerTemplate(result),
      margin: { top: '26mm', bottom: '22mm', left: '16mm', right: '16mm' },
    });
  } finally {
    await browser.close();
  }
}

export function reportFilename(result) {
  const name = String(result.product_name || 'Product')
    .replace(/[\\/:*?"<>|]+/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return `Quality-Report-${name}-${formatDate(result.meta.created_at)}.pdf`;
}
