#!/usr/bin/env ts-node
/**
 * Saudi Exchange Reports Downloader
 * Downloads annual member trading reports and stores data in database
 */

import { Command } from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';
import axios from 'axios';
import { SaudiExchangeDB, BrokerTradingData } from './database';

// Known report URLs from Saudi Exchange
const KNOWN_REPORT_URLS: Record<number, { main?: string; nomu?: string; combined?: string }> = {
  2024: {
    combined: 'https://www.saudiexchange.sa/wps/wcm/connect/196987cf-f6b1-4f64-9fe4-430821edbf24/Saudi+Exchange+Statistical+Report+2024+En.pdf',
  },
  2023: {
    combined: 'https://www.saudiexchange.sa/wps/wcm/connect/42563a22-e5a7-4cb9-a83f-6a109ab6036d/Saudi+Exchange+-Annual+Statistical+Report++2023+-+En.pdf',
  },
};

interface DownloadConfig {
  outputDir: string;
  years: number[];
  forceDownload: boolean;
  importFromCsv?: string;
}

class ReportDownloader {
  private db: SaudiExchangeDB;
  private config: DownloadConfig;

  constructor(config: DownloadConfig) {
    this.config = config;
    this.db = new SaudiExchangeDB();
  }

  async downloadReports(): Promise<void> {
    console.log('沙特交易所年报下载器');
    console.log('='.repeat(40));

    // Ensure output directory exists
    await fs.ensureDir(this.config.outputDir);

    for (const year of this.config.years) {
      console.log(`\n处理 ${year} 年报告...`);

      const urls = KNOWN_REPORT_URLS[year];
      if (!urls) {
        console.log(`  ⚠️ ${year} 年报告URL未知，跳过`);
        continue;
      }

      // Try to download combined report
      if (urls.combined) {
        await this.downloadReport(year, 'combined', urls.combined);
      }
      if (urls.main) {
        await this.downloadReport(year, 'main', urls.main);
      }
      if (urls.nomu) {
        await this.downloadReport(year, 'nomu', urls.nomu);
      }
    }

    console.log('\n下载完成！');
    console.log('注意：由于沙特交易所网站有反爬虫保护，可能需要手动下载PDF文件');
    console.log(`请将PDF文件放置于: ${this.config.outputDir}`);
    console.log('然后使用 --import-from-csv 参数从CSV导入数据');
  }

  private async downloadReport(year: number, type: string, url: string): Promise<void> {
    const fileName = `saudi_exchange_${year}_${type}.pdf`;
    const filePath = path.join(this.config.outputDir, fileName);

    // Check if already downloaded
    if (await fs.pathExists(filePath) && !this.config.forceDownload) {
      console.log(`  ✓ ${fileName} 已存在`);
      return;
    }

    console.log(`  下载: ${fileName}`);

    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/pdf',
        },
        timeout: 60000,
      });

      if (response.status === 200 && response.data.length > 0) {
        await fs.writeFile(filePath, response.data);
        console.log(`  ✓ 下载成功: ${fileName}`);

        // Save metadata
        this.db.saveReportMetadata({
          year,
          market_type: type,
          report_url: url,
          download_date: new Date().toISOString(),
          file_path: filePath,
        });
      }
    } catch (error: any) {
      if (error.response?.status === 403) {
        console.log(`  ✗ 下载失败: 访问被拒绝 (403) - 需要手动下载`);
        console.log(`    URL: ${url}`);
      } else {
        console.log(`  ✗ 下载失败: ${error.message}`);
      }
    }
  }

  async importFromCsv(csvPath: string): Promise<void> {
    console.log(`\n从CSV导入数据: ${csvPath}`);

    if (!await fs.pathExists(csvPath)) {
      console.error(`错误: CSV文件不存在: ${csvPath}`);
      return;
    }

    const content = await fs.readFile(csvPath, 'utf-8');
    const lines = content.split('\n').filter((line: string) => line.trim());

    if (lines.length < 2) {
      console.error('错误: CSV文件格式不正确');
      return;
    }

    // Parse header
    const header = lines[0].split(',').map((h: string) => h.trim().toLowerCase());
    const requiredFields = ['year', 'broker_name', 'broker_rank', 'market_type', 'total_value'];

    for (const field of requiredFields) {
      if (!header.includes(field)) {
        console.error(`错误: CSV缺少必要字段: ${field}`);
        return;
      }
    }

    // Parse data rows
    const data: BrokerTradingData[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i]);
      if (values.length !== header.length) {
        console.log(`  ⚠️ 跳过第${i + 1}行: 列数不匹配`);
        continue;
      }

      const row: Record<string, string> = {};
      header.forEach((h: string, idx: number) => {
        row[h] = values[idx];
      });

      data.push({
        year: parseInt(row.year),
        broker_name: row.broker_name,
        broker_rank: parseInt(row.broker_rank),
        market_type: row.market_type as 'main' | 'nomu',
        buy_value: parseFloat(row.buy_value || '0'),
        sell_value: parseFloat(row.sell_value || '0'),
        total_value: parseFloat(row.total_value),
        buy_volume: parseFloat(row.buy_volume || '0'),
        sell_volume: parseFloat(row.sell_volume || '0'),
        total_volume: parseFloat(row.total_volume || '0'),
        market_share_value: parseFloat(row.market_share_value || '0'),
        market_share_volume: parseFloat(row.market_share_volume || '0'),
      });
    }

    // Insert into database
    console.log(`  导入 ${data.length} 条记录...`);
    this.db.insertBrokerDataBatch(data);
    console.log('  ✓ 导入完成');
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());

    return result;
  }

  close(): void {
    this.db.close();
  }
}

// CLI Entry Point
async function main(): Promise<void> {
  const program = new Command();

  program
    .name('download-reports')
    .description('Download Saudi Exchange annual member trading reports')
    .option('--output <dir>', 'Output directory for downloaded files', './data/reports')
    .option('--years <years>', 'Years to download (comma-separated)', '2023,2024')
    .option('--force', 'Force re-download existing files', false)
    .option('--import-from-csv <file>', 'Import data from CSV file')
    .parse();

  const options = program.opts();

  const config: DownloadConfig = {
    outputDir: path.resolve(options.output),
    years: options.years.split(',').map((y: string) => parseInt(y.trim())),
    forceDownload: options.force,
    importFromCsv: options.importFromCsv,
  };

  const downloader = new ReportDownloader(config);

  try {
    if (config.importFromCsv) {
      await downloader.importFromCsv(config.importFromCsv);
    } else {
      await downloader.downloadReports();
    }
  } finally {
    downloader.close();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { ReportDownloader };
