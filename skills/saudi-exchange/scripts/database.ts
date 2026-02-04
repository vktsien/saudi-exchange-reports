/**
 * Saudi Exchange Reports Database Module
 * Stores broker trading data from annual reports
 */

import Database from 'better-sqlite3';
import * as path from 'path';

export type MarketType = 'main' | 'nomu' | 'all';

export interface BrokerTradingData {
  year: number;
  broker_name: string;
  broker_rank: number;
  market_type: 'main' | 'nomu';
  buy_value: number;
  sell_value: number;
  total_value: number;
  buy_volume: number;
  sell_volume: number;
  total_volume: number;
  market_share_value: number;
  market_share_volume: number;
}

export interface ReportMetadata {
  year: number;
  market_type: string;
  report_url: string;
  download_date: string;
  file_path: string;
}

export class SaudiExchangeDB {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const defaultPath = path.join(__dirname, '..', 'data', 'saudi_exchange.db');
    this.db = new Database(dbPath || defaultPath);
    this.init();
  }

  private init(): void {
    // Create broker trading data table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS broker_trading_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER NOT NULL,
        broker_name TEXT NOT NULL,
        broker_rank INTEGER NOT NULL,
        market_type TEXT NOT NULL CHECK(market_type IN ('main', 'nomu')),
        buy_value REAL NOT NULL,
        sell_value REAL NOT NULL,
        total_value REAL NOT NULL,
        buy_volume REAL NOT NULL,
        sell_volume REAL NOT NULL,
        total_volume REAL NOT NULL,
        market_share_value REAL,
        market_share_volume REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(year, broker_name, market_type)
      )
    `);

    // Create reports metadata table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reports_metadata (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER NOT NULL,
        market_type TEXT NOT NULL,
        report_url TEXT,
        download_date TEXT,
        file_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(year, market_type)
      )
    `);

    // Create indexes for faster queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_broker_year_market
      ON broker_trading_data(year, market_type);

      CREATE INDEX IF NOT EXISTS idx_broker_rank
      ON broker_trading_data(year, market_type, broker_rank);
    `);
  }

  getTables(): string[] {
    const stmt = this.db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);
    return stmt.all().map((row: any) => row.name);
  }

  insertBrokerData(data: BrokerTradingData): void {
    const stmt = this.db.prepare(`
      INSERT INTO broker_trading_data (
        year, broker_name, broker_rank, market_type,
        buy_value, sell_value, total_value,
        buy_volume, sell_volume, total_volume,
        market_share_value, market_share_volume,
        updated_at
      ) VALUES (
        @year, @broker_name, @broker_rank, @market_type,
        @buy_value, @sell_value, @total_value,
        @buy_volume, @sell_volume, @total_volume,
        @market_share_value, @market_share_volume,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT(year, broker_name, market_type) DO UPDATE SET
        broker_rank = @broker_rank,
        buy_value = @buy_value,
        sell_value = @sell_value,
        total_value = @total_value,
        buy_volume = @buy_volume,
        sell_volume = @sell_volume,
        total_volume = @total_volume,
        market_share_value = @market_share_value,
        market_share_volume = @market_share_volume,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(data);
  }

  insertBrokerDataBatch(dataList: BrokerTradingData[]): void {
    const insertMany = this.db.transaction((items: BrokerTradingData[]) => {
      for (const data of items) {
        this.insertBrokerData(data);
      }
    });
    insertMany(dataList);
  }

  getBrokerDataByYear(year: number, marketType: MarketType): BrokerTradingData[] {
    let query = `
      SELECT * FROM broker_trading_data
      WHERE year = ?
    `;
    const params: any[] = [year];

    if (marketType !== 'all') {
      query += ' AND market_type = ?';
      params.push(marketType);
    }

    query += ' ORDER BY broker_rank ASC';

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as BrokerTradingData[];
  }

  getTopBrokers(year: number, marketType: MarketType, limit: number): BrokerTradingData[] {
    let query = `
      SELECT * FROM broker_trading_data
      WHERE year = ?
    `;
    const params: any[] = [year];

    if (marketType !== 'all') {
      query += ' AND market_type = ?';
      params.push(marketType);
    }

    query += ' ORDER BY broker_rank ASC LIMIT ?';
    params.push(limit);

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as BrokerTradingData[];
  }

  getBrokerByName(year: number, brokerName: string, marketType: MarketType): BrokerTradingData | null {
    let query = `
      SELECT * FROM broker_trading_data
      WHERE year = ? AND broker_name = ?
    `;
    const params: any[] = [year, brokerName];

    if (marketType !== 'all') {
      query += ' AND market_type = ?';
      params.push(marketType);
    }

    const stmt = this.db.prepare(query);
    return stmt.get(...params) as BrokerTradingData | null;
  }

  getAvailableYears(): number[] {
    const stmt = this.db.prepare(`
      SELECT DISTINCT year FROM broker_trading_data
      ORDER BY year ASC
    `);
    return stmt.all().map((row: any) => row.year);
  }

  getAvailableMarketTypes(year: number): string[] {
    const stmt = this.db.prepare(`
      SELECT DISTINCT market_type FROM broker_trading_data
      WHERE year = ?
      ORDER BY market_type ASC
    `);
    return stmt.all(year).map((row: any) => row.market_type);
  }

  getTotalMarketValue(year: number, marketType: MarketType): number {
    let query = `
      SELECT SUM(total_value) as total FROM broker_trading_data
      WHERE year = ?
    `;
    const params: any[] = [year];

    if (marketType !== 'all') {
      query += ' AND market_type = ?';
      params.push(marketType);
    }

    const stmt = this.db.prepare(query);
    const result = stmt.get(...params) as { total: number } | undefined;
    return result?.total || 0;
  }

  saveReportMetadata(metadata: ReportMetadata): void {
    const stmt = this.db.prepare(`
      INSERT INTO reports_metadata (
        year, market_type, report_url, download_date, file_path
      ) VALUES (
        @year, @market_type, @report_url, @download_date, @file_path
      )
      ON CONFLICT(year, market_type) DO UPDATE SET
        report_url = @report_url,
        download_date = @download_date,
        file_path = @file_path
    `);
    stmt.run(metadata);
  }

  getReportMetadata(year: number, marketType: string): ReportMetadata | null {
    const stmt = this.db.prepare(`
      SELECT * FROM reports_metadata
      WHERE year = ? AND market_type = ?
    `);
    return stmt.get(year, marketType) as ReportMetadata | null;
  }

  getAllReportMetadata(): ReportMetadata[] {
    const stmt = this.db.prepare(`
      SELECT * FROM reports_metadata
      ORDER BY year DESC, market_type ASC
    `);
    return stmt.all() as ReportMetadata[];
  }

  close(): void {
    this.db.close();
  }
}
