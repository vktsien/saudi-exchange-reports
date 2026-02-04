#!/usr/bin/env ts-node
/**
 * Saudi Exchange Broker Ranking Report Generator
 * Generates year-over-year comparison reports for top brokers
 */

import { Command } from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';
import { SaudiExchangeDB, MarketType } from './database';
import { BrokerReportGenerator } from './broker-report-generator';

interface ReportConfig {
  outputFile: string;
  currentYear: number;
  previousYear: number;
  marketType: MarketType;
  topN: number;
  format: 'markdown' | 'json';
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name('generate-broker-report')
    .description('Generate Saudi Exchange broker ranking comparison report')
    .option('--output <file>', 'Output file path', './broker-report.md')
    .option('--current-year <year>', 'Current year to compare', String(new Date().getFullYear()))
    .option('--previous-year <year>', 'Previous year to compare', String(new Date().getFullYear() - 1))
    .option('--market <type>', 'Market type: main, nomu, or all', 'main')
    .option('--top <n>', 'Number of top brokers to include', '10')
    .option('--format <type>', 'Output format: markdown or json', 'markdown')
    .parse();

  const options = program.opts();

  const config: ReportConfig = {
    outputFile: path.resolve(options.output),
    currentYear: parseInt(options.currentYear),
    previousYear: parseInt(options.previousYear),
    marketType: options.market as MarketType,
    topN: parseInt(options.top),
    format: options.format as 'markdown' | 'json',
  };

  console.log('沙特交易所 Broker 排名报告生成器');
  console.log('='.repeat(40));
  console.log(`对比年份: ${config.previousYear} → ${config.currentYear}`);
  console.log(`市场类型: ${config.marketType}`);
  console.log(`Top N: ${config.topN}`);
  console.log('');

  const db = new SaudiExchangeDB();
  const generator = new BrokerReportGenerator(db);

  try {
    // Check available data
    const availableYears = db.getAvailableYears();
    console.log(`数据库中可用年份: ${availableYears.join(', ') || '无数据'}`);

    if (availableYears.length === 0) {
      console.log('\n⚠️ 数据库中没有数据');
      console.log('请先使用 download-reports.ts 下载并导入数据');
      console.log('或使用 --import-from-csv 从CSV文件导入数据');

      // Generate sample data instructions
      console.log('\n示例CSV格式:');
      console.log('year,broker_name,broker_rank,market_type,buy_value,sell_value,total_value,buy_volume,sell_volume,total_volume,market_share_value,market_share_volume');
      console.log('2024,Al Rajhi Capital,1,main,100000000,95000000,195000000,5000000,4800000,9800000,15.5,14.2');
      return;
    }

    if (!availableYears.includes(config.currentYear)) {
      console.log(`\n⚠️ 数据库中没有 ${config.currentYear} 年的数据`);
      return;
    }

    if (!availableYears.includes(config.previousYear)) {
      console.log(`\n⚠️ 数据库中没有 ${config.previousYear} 年的数据`);
      return;
    }

    // Generate report
    const report = generator.generateYearOverYearReport(
      config.currentYear,
      config.previousYear,
      config.marketType,
      config.topN
    );

    let output: string;
    if (config.format === 'json') {
      output = JSON.stringify(report, null, 2);
    } else {
      output = generator.formatReportAsTable(report);
    }

    // Write output
    await fs.ensureDir(path.dirname(config.outputFile));
    await fs.writeFile(config.outputFile, output, 'utf-8');

    console.log(`\n✓ 报告已生成: ${config.outputFile}`);

    // Print summary
    console.log('\n报告摘要:');
    console.log(`- Top ${config.topN} 总交易额增长: ${report.top10GrowthPct.toFixed(2)}%`);
    if (report.biggestGainer) {
      console.log(`- 最大升幅: ${report.biggestGainer.broker_name}`);
    }
    if (report.biggestLoser && report.biggestLoser.rank_change! < 0) {
      console.log(`- 最大跌幅: ${report.biggestLoser.broker_name}`);
    }
    if (report.droppedOut.length > 0) {
      console.log(`- 跌出Top ${config.topN}: ${report.droppedOut.join(', ')}`);
    }

  } finally {
    db.close();
  }
}

if (require.main === module) {
  main().catch(console.error);
}
