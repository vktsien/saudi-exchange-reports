/**
 * Broker Report Generator Tests - TDD for ranking and comparison reports
 */

import { BrokerReportGenerator, BrokerComparison, YearOverYearReport } from '../broker-report-generator';
import { SaudiExchangeDB, BrokerTradingData } from '../database';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DB_PATH = path.join(__dirname, 'test-report.db');

describe('BrokerReportGenerator', () => {
  let db: SaudiExchangeDB;
  let generator: BrokerReportGenerator;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    db = new SaudiExchangeDB(TEST_DB_PATH);
    generator = new BrokerReportGenerator(db);

    // Insert test data for multiple years
    const testData = [
      // 2023 data
      { year: 2023, broker_name: 'Al Rajhi Capital', rank: 1, value: 180000000 },
      { year: 2023, broker_name: 'SNB Capital', rank: 2, value: 160000000 },
      { year: 2023, broker_name: 'Riyad Capital', rank: 3, value: 140000000 },
      { year: 2023, broker_name: 'HSBC Saudi', rank: 4, value: 120000000 },
      { year: 2023, broker_name: 'Morgan Stanley', rank: 5, value: 100000000 },
      { year: 2023, broker_name: 'Goldman Sachs', rank: 6, value: 90000000 },
      { year: 2023, broker_name: 'JP Morgan', rank: 7, value: 80000000 },
      { year: 2023, broker_name: 'Citi', rank: 8, value: 70000000 },
      { year: 2023, broker_name: 'Deutsche Bank', rank: 9, value: 60000000 },
      { year: 2023, broker_name: 'UBS', rank: 10, value: 50000000 },
      // 2024 data (with rank changes)
      { year: 2024, broker_name: 'Al Rajhi Capital', rank: 1, value: 200000000 },
      { year: 2024, broker_name: 'Riyad Capital', rank: 2, value: 190000000 }, // moved up
      { year: 2024, broker_name: 'SNB Capital', rank: 3, value: 170000000 }, // moved down
      { year: 2024, broker_name: 'Morgan Stanley', rank: 4, value: 150000000 }, // moved up
      { year: 2024, broker_name: 'HSBC Saudi', rank: 5, value: 130000000 }, // moved down
      { year: 2024, broker_name: 'JP Morgan', rank: 6, value: 110000000 }, // moved up
      { year: 2024, broker_name: 'Goldman Sachs', rank: 7, value: 95000000 }, // moved down
      { year: 2024, broker_name: 'Citi', rank: 8, value: 75000000 },
      { year: 2024, broker_name: 'New Broker', rank: 9, value: 65000000 }, // new entrant
      { year: 2024, broker_name: 'UBS', rank: 10, value: 55000000 },
    ];

    testData.forEach((d) => {
      db.insertBrokerData({
        year: d.year,
        broker_name: d.broker_name,
        broker_rank: d.rank,
        market_type: 'main',
        buy_value: d.value / 2,
        sell_value: d.value / 2,
        total_value: d.value,
        buy_volume: 1000000,
        sell_volume: 1000000,
        total_volume: 2000000,
        market_share_value: 10,
        market_share_volume: 10,
      });
    });
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('generateYearOverYearReport', () => {
    it('should generate YoY comparison for top 10 brokers', () => {
      const report = generator.generateYearOverYearReport(2024, 2023, 'main', 10);

      expect(report.currentYear).toBe(2024);
      expect(report.previousYear).toBe(2023);
      expect(report.marketType).toBe('main');
      expect(report.comparisons.length).toBe(10);
    });

    it('should correctly calculate rank changes', () => {
      const report = generator.generateYearOverYearReport(2024, 2023, 'main', 10);

      // Al Rajhi stayed at rank 1
      const alRajhi = report.comparisons.find((c) => c.broker_name === 'Al Rajhi Capital');
      expect(alRajhi?.rank_change).toBe(0);

      // Riyad Capital moved from 3 to 2 (positive change, moved up)
      const riyad = report.comparisons.find((c) => c.broker_name === 'Riyad Capital');
      expect(riyad?.rank_change).toBe(1); // positive means moved up

      // SNB Capital moved from 2 to 3 (negative change, moved down)
      const snb = report.comparisons.find((c) => c.broker_name === 'SNB Capital');
      expect(snb?.rank_change).toBe(-1); // negative means moved down
    });

    it('should handle new entrants (no previous year data)', () => {
      const report = generator.generateYearOverYearReport(2024, 2023, 'main', 10);

      const newBroker = report.comparisons.find((c) => c.broker_name === 'New Broker');
      expect(newBroker).toBeDefined();
      expect(newBroker?.previous_rank).toBeNull();
      expect(newBroker?.rank_change).toBeNull();
      expect(newBroker?.is_new_entrant).toBe(true);
    });

    it('should calculate value growth percentage', () => {
      const report = generator.generateYearOverYearReport(2024, 2023, 'main', 10);

      // Al Rajhi: 200M vs 180M = 11.11% growth
      const alRajhi = report.comparisons.find((c) => c.broker_name === 'Al Rajhi Capital');
      expect(alRajhi?.value_growth_pct).toBeCloseTo(11.11, 1);
    });

    it('should identify brokers that dropped out of top N', () => {
      const report = generator.generateYearOverYearReport(2024, 2023, 'main', 10);

      // Deutsche Bank was rank 9 in 2023, not in top 10 for 2024
      expect(report.droppedOut).toContain('Deutsche Bank');
    });
  });

  describe('formatReportAsTable', () => {
    it('should generate markdown table format', () => {
      const report = generator.generateYearOverYearReport(2024, 2023, 'main', 10);
      const table = generator.formatReportAsTable(report);

      expect(table).toContain('| 排名 |');
      expect(table).toContain('| Broker名称 |');
      expect(table).toContain('| 排名变化 |');
      expect(table).toContain('| 交易额(SAR) |');
      expect(table).toContain('| 增长率 |');
    });

    it('should show up arrow for rank improvement', () => {
      const report = generator.generateYearOverYearReport(2024, 2023, 'main', 10);
      const table = generator.formatReportAsTable(report);

      // Riyad Capital moved up
      expect(table).toMatch(/Riyad Capital.*↑/);
    });

    it('should show down arrow for rank decline', () => {
      const report = generator.generateYearOverYearReport(2024, 2023, 'main', 10);
      const table = generator.formatReportAsTable(report);

      // SNB Capital moved down
      expect(table).toMatch(/SNB Capital.*↓/);
    });

    it('should show "NEW" for new entrants', () => {
      const report = generator.generateYearOverYearReport(2024, 2023, 'main', 10);
      const table = generator.formatReportAsTable(report);

      expect(table).toMatch(/New Broker.*NEW/);
    });
  });

  describe('generateSummaryStats', () => {
    it('should calculate total market value', () => {
      const stats = generator.generateSummaryStats(2024, 'main');

      expect(stats.totalValue).toBeGreaterThan(0);
      expect(stats.top10Value).toBeGreaterThan(0);
      expect(stats.top10Share).toBeGreaterThan(0);
    });

    it('should identify biggest movers', () => {
      const report = generator.generateYearOverYearReport(2024, 2023, 'main', 10);

      expect(report.biggestGainer).toBeDefined();
      expect(report.biggestLoser).toBeDefined();
    });
  });

  describe('market type filtering', () => {
    beforeEach(() => {
      // Add Nomu market data
      const nomuData = [
        { year: 2024, broker_name: 'Nomu Broker 1', rank: 1, value: 50000000 },
        { year: 2024, broker_name: 'Nomu Broker 2', rank: 2, value: 40000000 },
        { year: 2023, broker_name: 'Nomu Broker 1', rank: 1, value: 45000000 },
        { year: 2023, broker_name: 'Nomu Broker 2', rank: 2, value: 35000000 },
      ];

      nomuData.forEach((d) => {
        db.insertBrokerData({
          year: d.year,
          broker_name: d.broker_name,
          broker_rank: d.rank,
          market_type: 'nomu',
          buy_value: d.value / 2,
          sell_value: d.value / 2,
          total_value: d.value,
          buy_volume: 500000,
          sell_volume: 500000,
          total_volume: 1000000,
          market_share_value: 50,
          market_share_volume: 50,
        });
      });
    });

    it('should filter by main market', () => {
      const report = generator.generateYearOverYearReport(2024, 2023, 'main', 10);
      const brokerNames = report.comparisons.map((c) => c.broker_name);

      expect(brokerNames).not.toContain('Nomu Broker 1');
      expect(brokerNames).not.toContain('Nomu Broker 2');
    });

    it('should filter by nomu market', () => {
      const report = generator.generateYearOverYearReport(2024, 2023, 'nomu', 10);

      expect(report.comparisons.length).toBe(2);
      expect(report.comparisons[0].broker_name).toBe('Nomu Broker 1');
    });

    it('should combine all markets when type is "all"', () => {
      const report = generator.generateYearOverYearReport(2024, 2023, 'all', 20);

      expect(report.comparisons.length).toBe(12); // 10 main + 2 nomu
    });
  });
});
