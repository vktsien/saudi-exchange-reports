#!/usr/bin/env ts-node
/**
 * Saudi Exchange Reports Scraper using Playwright with Stealth
 * Bypasses anti-crawler protection by using a real browser with stealth plugin
 */

import { chromium as playwrightChromium, Browser, Page } from 'playwright';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Command } from 'commander';
import { SaudiExchangeDB, BrokerTradingData } from './database';

// Add stealth plugin
chromium.use(StealthPlugin());

const MEMBER_TRADING_REPORTS_URL = 'https://www.saudiexchange.sa/wps/portal/saudiexchange/newsandreports/reports-publications/member-trading-reports?locale=en';

interface ScraperConfig {
  outputDir: string;
  years: number[];
  headless: boolean;
  debug: boolean;
}

interface ReportLink {
  year: number;
  title: string;
  url: string;
  market_type: 'main' | 'nomu' | 'combined';
}

class SaudiExchangeScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private config: ScraperConfig;
  private db: SaudiExchangeDB;

  constructor(config: ScraperConfig) {
    this.config = config;
    this.db = new SaudiExchangeDB();
  }

  async init(): Promise<void> {
    console.log('启动浏览器...');
    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
    });

    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
    });

    this.page = await context.newPage();

    // Block unnecessary resources for faster loading
    await this.page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      if (['image', 'font', 'media'].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });
  }

  async scrapeReportLinks(): Promise<ReportLink[]> {
    if (!this.page) throw new Error('Browser not initialized');

    console.log(`访问页面: ${MEMBER_TRADING_REPORTS_URL}`);

    try {
      await this.page.goto(MEMBER_TRADING_REPORTS_URL, {
        waitUntil: 'networkidle',
        timeout: 60000,
      });

      // Wait for page content to load
      await this.page.waitForTimeout(3000);

      if (this.config.debug) {
        const title = await this.page.title();
        console.log(`页面标题: ${title}`);

        // Save screenshot for debugging
        await this.page.screenshot({ path: path.join(this.config.outputDir, 'page_screenshot.png') });
        console.log('已保存页面截图');
      }

      // Try to find report links
      const reportLinks = await this.page.evaluate(() => {
        const links: Array<{ text: string; href: string }> = [];

        // Find all links that might be reports
        const anchors = document.querySelectorAll('a[href*=".pdf"], a[href*="download"], a[href*="report"]');
        anchors.forEach((a: Element) => {
          const href = (a as HTMLAnchorElement).href;
          const text = (a as HTMLAnchorElement).textContent?.trim() || '';
          if (href && (href.includes('.pdf') || href.toLowerCase().includes('report'))) {
            links.push({ text, href });
          }
        });

        // Also check for links in tables
        const tableLinks = document.querySelectorAll('table a');
        tableLinks.forEach((a: Element) => {
          const href = (a as HTMLAnchorElement).href;
          const text = (a as HTMLAnchorElement).textContent?.trim() || '';
          if (href) {
            links.push({ text, href });
          }
        });

        return links;
      });

      console.log(`找到 ${reportLinks.length} 个潜在报告链接`);

      if (this.config.debug) {
        reportLinks.forEach((link, i) => {
          console.log(`  ${i + 1}. ${link.text} -> ${link.href}`);
        });
      }

      // Parse and filter report links
      const parsedLinks: ReportLink[] = [];
      for (const link of reportLinks) {
        const parsed = this.parseReportLink(link.text, link.href);
        if (parsed && this.config.years.includes(parsed.year)) {
          parsedLinks.push(parsed);
        }
      }

      return parsedLinks;

    } catch (error: any) {
      console.error(`页面加载失败: ${error.message}`);

      // Try alternative approach - get page content
      const content = await this.page.content();
      if (this.config.debug) {
        await fs.writeFile(path.join(this.config.outputDir, 'page_content.html'), content);
        console.log('已保存页面HTML');
      }

      return [];
    }
  }

  private parseReportLink(text: string, href: string): ReportLink | null {
    // Extract year from text or URL
    const yearMatch = text.match(/20\d{2}/) || href.match(/20\d{2}/);
    if (!yearMatch) return null;

    const year = parseInt(yearMatch[0]);

    // Determine market type
    let market_type: 'main' | 'nomu' | 'combined' = 'combined';
    const lowerText = text.toLowerCase();
    const lowerHref = href.toLowerCase();

    if (lowerText.includes('main') || lowerHref.includes('main')) {
      market_type = 'main';
    } else if (lowerText.includes('nomu') || lowerText.includes('parallel') ||
               lowerHref.includes('nomu') || lowerHref.includes('parallel')) {
      market_type = 'nomu';
    }

    return {
      year,
      title: text || `Report ${year}`,
      url: href,
      market_type,
    };
  }

  async downloadReport(link: ReportLink): Promise<string | null> {
    if (!this.page) throw new Error('Browser not initialized');

    const fileName = `saudi_exchange_${link.year}_${link.market_type}.pdf`;
    const filePath = path.join(this.config.outputDir, fileName);

    // Check if already downloaded
    if (await fs.pathExists(filePath)) {
      console.log(`  ✓ ${fileName} 已存在`);
      return filePath;
    }

    console.log(`  下载: ${link.title}`);

    try {
      // Use page to download file
      const [download] = await Promise.all([
        this.page.waitForEvent('download', { timeout: 30000 }).catch(() => null),
        this.page.goto(link.url, { timeout: 30000 }).catch(() => null),
      ]);

      if (download) {
        await download.saveAs(filePath);
        console.log(`  ✓ 下载成功: ${fileName}`);

        // Save metadata
        this.db.saveReportMetadata({
          year: link.year,
          market_type: link.market_type,
          report_url: link.url,
          download_date: new Date().toISOString(),
          file_path: filePath,
        });

        return filePath;
      }

      // Alternative: try direct fetch with page cookies
      const response = await this.page.request.get(link.url);
      if (response.ok()) {
        const buffer = await response.body();
        await fs.writeFile(filePath, buffer);
        console.log(`  ✓ 下载成功: ${fileName}`);

        this.db.saveReportMetadata({
          year: link.year,
          market_type: link.market_type,
          report_url: link.url,
          download_date: new Date().toISOString(),
          file_path: filePath,
        });

        return filePath;
      }

      console.log(`  ✗ 下载失败: HTTP ${response.status()}`);
      return null;

    } catch (error: any) {
      console.log(`  ✗ 下载失败: ${error.message}`);
      return null;
    }
  }

  async scrapeTableData(): Promise<BrokerTradingData[]> {
    if (!this.page) throw new Error('Browser not initialized');

    console.log('尝试从页面抓取表格数据...');

    try {
      // Look for data tables on the page
      const tableData = await this.page.evaluate(() => {
        const tables = document.querySelectorAll('table');
        const results: any[] = [];

        tables.forEach((table: Element) => {
          const rows = table.querySelectorAll('tr');
          rows.forEach((row: Element) => {
            const cells = row.querySelectorAll('td, th');
            const rowData: string[] = [];
            cells.forEach((cell: Element) => {
              rowData.push(cell.textContent?.trim() || '');
            });
            if (rowData.length > 0) {
              results.push(rowData);
            }
          });
        });

        return results;
      });

      console.log(`找到 ${tableData.length} 行表格数据`);

      if (this.config.debug && tableData.length > 0) {
        console.log('表格数据预览:');
        tableData.slice(0, 5).forEach((row, i) => {
          console.log(`  ${i + 1}. ${row.join(' | ')}`);
        });
      }

      // Parse table data to broker data
      const brokerData = this.parseTableData(tableData);
      return brokerData;

    } catch (error: any) {
      console.error(`抓取表格数据失败: ${error.message}`);
      return [];
    }
  }

  private parseTableData(tableData: string[][]): BrokerTradingData[] {
    const brokerData: BrokerTradingData[] = [];

    // Try to identify header row and data rows
    // This is a heuristic approach - may need adjustment based on actual table structure
    for (let i = 0; i < tableData.length; i++) {
      const row = tableData[i];

      // Skip header-like rows
      if (row.some(cell => cell.toLowerCase().includes('broker') || cell.toLowerCase().includes('rank'))) {
        continue;
      }

      // Try to parse as data row
      // Expected format: Rank, Broker Name, Buy Value, Sell Value, Total Value, Market Share, etc.
      if (row.length >= 4) {
        const rankMatch = row[0].match(/\d+/);
        if (rankMatch) {
          try {
            brokerData.push({
              year: new Date().getFullYear(),
              broker_name: row[1] || 'Unknown',
              broker_rank: parseInt(rankMatch[0]),
              market_type: 'main',
              buy_value: this.parseNumber(row[2]),
              sell_value: this.parseNumber(row[3]),
              total_value: this.parseNumber(row[4]) || this.parseNumber(row[2]) + this.parseNumber(row[3]),
              buy_volume: 0,
              sell_volume: 0,
              total_volume: 0,
              market_share_value: this.parseNumber(row[5]) || 0,
              market_share_volume: 0,
            });
          } catch (e) {
            // Skip invalid rows
          }
        }
      }
    }

    return brokerData;
  }

  private parseNumber(str: string): number {
    if (!str) return 0;
    // Remove commas, percentage signs, and other non-numeric characters
    const cleaned = str.replace(/[,%]/g, '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  async run(): Promise<void> {
    console.log('沙特交易所报告抓取器 (Playwright)');
    console.log('='.repeat(40));

    await fs.ensureDir(this.config.outputDir);
    await this.init();

    try {
      // Scrape report links
      const links = await this.scrapeReportLinks();

      if (links.length > 0) {
        console.log(`\n找到 ${links.length} 个符合条件的报告`);

        for (const link of links) {
          await this.downloadReport(link);
        }
      } else {
        console.log('\n未找到报告链接，尝试抓取页面表格数据...');
        const data = await this.scrapeTableData();

        if (data.length > 0) {
          console.log(`抓取到 ${data.length} 条Broker数据`);
          this.db.insertBrokerDataBatch(data);
          console.log('数据已保存到数据库');
        }
      }

      console.log('\n抓取完成！');

    } finally {
      await this.close();
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
    this.db.close();
  }
}

// CLI Entry Point
async function main(): Promise<void> {
  const program = new Command();

  program
    .name('playwright-scraper')
    .description('Scrape Saudi Exchange member trading reports using Playwright')
    .option('--output <dir>', 'Output directory', './data/reports')
    .option('--years <years>', 'Years to scrape (comma-separated)', '2023,2024')
    .option('--headless', 'Run in headless mode', true)
    .option('--no-headless', 'Run with visible browser')
    .option('--debug', 'Enable debug output', false)
    .parse();

  const options = program.opts();

  const config: ScraperConfig = {
    outputDir: path.resolve(options.output),
    years: options.years.split(',').map((y: string) => parseInt(y.trim())),
    headless: options.headless,
    debug: options.debug,
  };

  const scraper = new SaudiExchangeScraper(config);
  await scraper.run();
}

if (require.main === module) {
  main().catch(console.error);
}

export { SaudiExchangeScraper };
