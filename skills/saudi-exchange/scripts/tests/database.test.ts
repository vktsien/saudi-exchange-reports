/**
 * Database Tests - TDD for Saudi Exchange Reports Database
 */

import { SaudiExchangeDB, BrokerTradingData, MarketType } from '../database';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DB_PATH = path.join(__dirname, 'test.db');

describe('SaudiExchangeDB', () => {
  let db: SaudiExchangeDB;

  beforeEach(() => {
    // Clean up test database before each test
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    db = new SaudiExchangeDB(TEST_DB_PATH);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('initialization', () => {
    it('should create database file', () => {
      expect(fs.existsSync(TEST_DB_PATH)).toBe(true);
    });

    it('should create broker_trading_data table', () => {
      const tables = db.getTables();
      expect(tables).toContain('broker_trading_data');
    });

    it('should create reports_metadata table', () => {
      const tables = db.getTables();
      expect(tables).toContain('reports_metadata');
    });
  });

  describe('insertBrokerData', () => {
    it('should insert broker trading data', () => {
      const data: BrokerTradingData = {
        year: 2024,
        broker_name: 'Al Rajhi Capital',
        broker_rank: 1,
        market_type: 'main',
        buy_value: 100000000,
        sell_value: 95000000,
        total_value: 195000000,
        buy_volume: 5000000,
        sell_volume: 4800000,
        total_volume: 9800000,
        market_share_value: 15.5,
        market_share_volume: 14.2,
      };

      db.insertBrokerData(data);
      const result = db.getBrokerDataByYear(2024, 'main');

      expect(result.length).toBe(1);
      expect(result[0].broker_name).toBe('Al Rajhi Capital');
      expect(result[0].broker_rank).toBe(1);
    });

    it('should handle upsert for existing data', () => {
      const data1: BrokerTradingData = {
        year: 2024,
        broker_name: 'Al Rajhi Capital',
        broker_rank: 1,
        market_type: 'main',
        buy_value: 100000000,
        sell_value: 95000000,
        total_value: 195000000,
        buy_volume: 5000000,
        sell_volume: 4800000,
        total_volume: 9800000,
        market_share_value: 15.5,
        market_share_volume: 14.2,
      };

      const data2: BrokerTradingData = {
        ...data1,
        total_value: 200000000, // Updated value
      };

      db.insertBrokerData(data1);
      db.insertBrokerData(data2);

      const result = db.getBrokerDataByYear(2024, 'main');
      expect(result.length).toBe(1);
      expect(result[0].total_value).toBe(200000000);
    });
  });

  describe('getBrokerDataByYear', () => {
    beforeEach(() => {
      // Insert test data
      const brokers = [
        { name: 'Al Rajhi Capital', rank: 1, value: 195000000 },
        { name: 'SNB Capital', rank: 2, value: 180000000 },
        { name: 'Riyad Capital', rank: 3, value: 150000000 },
      ];

      brokers.forEach((b) => {
        db.insertBrokerData({
          year: 2024,
          broker_name: b.name,
          broker_rank: b.rank,
          market_type: 'main',
          buy_value: b.value / 2,
          sell_value: b.value / 2,
          total_value: b.value,
          buy_volume: 1000000,
          sell_volume: 1000000,
          total_volume: 2000000,
          market_share_value: 10,
          market_share_volume: 10,
        });
      });
    });

    it('should return data sorted by rank', () => {
      const result = db.getBrokerDataByYear(2024, 'main');
      expect(result.length).toBe(3);
      expect(result[0].broker_rank).toBe(1);
      expect(result[1].broker_rank).toBe(2);
      expect(result[2].broker_rank).toBe(3);
    });

    it('should filter by market type', () => {
      db.insertBrokerData({
        year: 2024,
        broker_name: 'Nomu Broker',
        broker_rank: 1,
        market_type: 'nomu',
        buy_value: 50000000,
        sell_value: 50000000,
        total_value: 100000000,
        buy_volume: 500000,
        sell_volume: 500000,
        total_volume: 1000000,
        market_share_value: 20,
        market_share_volume: 20,
      });

      const mainResult = db.getBrokerDataByYear(2024, 'main');
      const nomuResult = db.getBrokerDataByYear(2024, 'nomu');

      expect(mainResult.length).toBe(3);
      expect(nomuResult.length).toBe(1);
      expect(nomuResult[0].broker_name).toBe('Nomu Broker');
    });

    it('should return all markets when market_type is "all"', () => {
      db.insertBrokerData({
        year: 2024,
        broker_name: 'Nomu Broker',
        broker_rank: 1,
        market_type: 'nomu',
        buy_value: 50000000,
        sell_value: 50000000,
        total_value: 100000000,
        buy_volume: 500000,
        sell_volume: 500000,
        total_volume: 1000000,
        market_share_value: 20,
        market_share_volume: 20,
      });

      const result = db.getBrokerDataByYear(2024, 'all');
      expect(result.length).toBe(4);
    });
  });

  describe('getAvailableYears', () => {
    it('should return list of available years', () => {
      [2022, 2023, 2024].forEach((year) => {
        db.insertBrokerData({
          year,
          broker_name: 'Test Broker',
          broker_rank: 1,
          market_type: 'main',
          buy_value: 100000000,
          sell_value: 100000000,
          total_value: 200000000,
          buy_volume: 1000000,
          sell_volume: 1000000,
          total_volume: 2000000,
          market_share_value: 10,
          market_share_volume: 10,
        });
      });

      const years = db.getAvailableYears();
      expect(years).toEqual([2022, 2023, 2024]);
    });
  });

  describe('getTopBrokers', () => {
    it('should return top N brokers', () => {
      for (let i = 1; i <= 15; i++) {
        db.insertBrokerData({
          year: 2024,
          broker_name: `Broker ${i}`,
          broker_rank: i,
          market_type: 'main',
          buy_value: (16 - i) * 10000000,
          sell_value: (16 - i) * 10000000,
          total_value: (16 - i) * 20000000,
          buy_volume: 1000000,
          sell_volume: 1000000,
          total_volume: 2000000,
          market_share_value: 10,
          market_share_volume: 10,
        });
      }

      const top10 = db.getTopBrokers(2024, 'main', 10);
      expect(top10.length).toBe(10);
      expect(top10[0].broker_rank).toBe(1);
      expect(top10[9].broker_rank).toBe(10);
    });
  });

  describe('saveReportMetadata', () => {
    it('should save report download metadata', () => {
      db.saveReportMetadata({
        year: 2024,
        market_type: 'main',
        report_url: 'https://example.com/report.pdf',
        download_date: new Date().toISOString(),
        file_path: '/path/to/report.pdf',
      });

      const metadata = db.getReportMetadata(2024, 'main');
      expect(metadata).not.toBeNull();
      expect(metadata?.report_url).toBe('https://example.com/report.pdf');
    });
  });
});
