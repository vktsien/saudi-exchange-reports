/**
 * Broker Report Generator
 * Generates year-over-year comparison reports for top brokers
 */

import { SaudiExchangeDB, BrokerTradingData, MarketType } from './database';

export interface BrokerComparison {
  broker_name: string;
  current_rank: number;
  previous_rank: number | null;
  rank_change: number | null;
  is_new_entrant: boolean;
  current_value: number;
  previous_value: number | null;
  value_growth_pct: number | null;
  current_volume: number;
  previous_volume: number | null;
  volume_growth_pct: number | null;
  market_share_value: number;
}

export interface YearOverYearReport {
  currentYear: number;
  previousYear: number;
  marketType: MarketType;
  comparisons: BrokerComparison[];
  droppedOut: string[];
  biggestGainer: BrokerComparison | null;
  biggestLoser: BrokerComparison | null;
  totalTop10Value: number;
  totalTop10ValuePrevious: number;
  top10GrowthPct: number;
}

export interface SummaryStats {
  year: number;
  marketType: MarketType;
  totalValue: number;
  top10Value: number;
  top10Share: number;
  brokerCount: number;
}

export class BrokerReportGenerator {
  private db: SaudiExchangeDB;

  constructor(db: SaudiExchangeDB) {
    this.db = db;
  }

  generateYearOverYearReport(
    currentYear: number,
    previousYear: number,
    marketType: MarketType,
    topN: number = 10
  ): YearOverYearReport {
    const currentData = this.db.getTopBrokers(currentYear, marketType, topN);
    const previousData = this.db.getBrokerDataByYear(previousYear, marketType);

    // Create lookup map for previous year data
    const previousMap = new Map<string, BrokerTradingData>();
    previousData.forEach((d) => previousMap.set(d.broker_name, d));

    // Generate comparisons for current top N
    const comparisons: BrokerComparison[] = currentData.map((current) => {
      const previous = previousMap.get(current.broker_name);
      const isNewEntrant = !previous;

      let rankChange: number | null = null;
      if (previous) {
        // Positive rank change means moved up (e.g., from 3 to 2 = +1)
        rankChange = previous.broker_rank - current.broker_rank;
      }

      let valueGrowthPct: number | null = null;
      if (previous && previous.total_value > 0) {
        valueGrowthPct = ((current.total_value - previous.total_value) / previous.total_value) * 100;
      }

      let volumeGrowthPct: number | null = null;
      if (previous && previous.total_volume > 0) {
        volumeGrowthPct = ((current.total_volume - previous.total_volume) / previous.total_volume) * 100;
      }

      return {
        broker_name: current.broker_name,
        current_rank: current.broker_rank,
        previous_rank: previous?.broker_rank ?? null,
        rank_change: rankChange,
        is_new_entrant: isNewEntrant,
        current_value: current.total_value,
        previous_value: previous?.total_value ?? null,
        value_growth_pct: valueGrowthPct,
        current_volume: current.total_volume,
        previous_volume: previous?.total_volume ?? null,
        volume_growth_pct: volumeGrowthPct,
        market_share_value: current.market_share_value,
      };
    });

    // Find brokers that dropped out of top N
    const currentBrokerNames = new Set(currentData.map((d) => d.broker_name));
    const previousTopN = this.db.getTopBrokers(previousYear, marketType, topN);
    const droppedOut = previousTopN
      .filter((d) => !currentBrokerNames.has(d.broker_name))
      .map((d) => d.broker_name);

    // Find biggest gainer and loser (by rank change, excluding new entrants)
    const validComparisons = comparisons.filter((c) => c.rank_change !== null);

    let biggestGainer: BrokerComparison | null = null;
    let biggestLoser: BrokerComparison | null = null;

    if (validComparisons.length > 0) {
      biggestGainer = validComparisons.reduce((max, c) =>
        (c.rank_change! > (max.rank_change || -Infinity)) ? c : max
      );
      biggestLoser = validComparisons.reduce((min, c) =>
        (c.rank_change! < (min.rank_change || Infinity)) ? c : min
      );
    }

    // Calculate totals
    const totalTop10Value = currentData.reduce((sum, d) => sum + d.total_value, 0);
    const previousTop10 = previousTopN.slice(0, topN);
    const totalTop10ValuePrevious = previousTop10.reduce((sum, d) => sum + d.total_value, 0);

    const top10GrowthPct = totalTop10ValuePrevious > 0
      ? ((totalTop10Value - totalTop10ValuePrevious) / totalTop10ValuePrevious) * 100
      : 0;

    return {
      currentYear,
      previousYear,
      marketType,
      comparisons,
      droppedOut,
      biggestGainer,
      biggestLoser,
      totalTop10Value,
      totalTop10ValuePrevious,
      top10GrowthPct,
    };
  }

  formatReportAsTable(report: YearOverYearReport): string {
    const lines: string[] = [];

    // Header
    lines.push(`# 沙特交易所 Broker 排名对比报告`);
    lines.push('');
    lines.push(`**对比年份**: ${report.previousYear} → ${report.currentYear}`);
    lines.push(`**市场类型**: ${this.getMarketTypeName(report.marketType)}`);
    lines.push(`**Top 10 总交易额增长**: ${report.top10GrowthPct.toFixed(2)}%`);
    lines.push('');

    // Summary
    if (report.biggestGainer) {
      lines.push(`**最大升幅**: ${report.biggestGainer.broker_name} (↑${report.biggestGainer.rank_change}名)`);
    }
    if (report.biggestLoser && report.biggestLoser.rank_change! < 0) {
      lines.push(`**最大跌幅**: ${report.biggestLoser.broker_name} (↓${Math.abs(report.biggestLoser.rank_change!)}名)`);
    }
    if (report.droppedOut.length > 0) {
      lines.push(`**跌出Top 10**: ${report.droppedOut.join(', ')}`);
    }
    lines.push('');

    // Table header
    lines.push('| 排名 | Broker名称 | 排名变化 | 交易额(SAR) | 增长率 | 市场份额 |');
    lines.push('|:----:|:-----------|:--------:|------------:|-------:|--------:|');

    // Table rows
    for (const comp of report.comparisons) {
      const rank = comp.current_rank;
      const name = comp.broker_name;

      let rankChangeStr: string;
      if (comp.is_new_entrant) {
        rankChangeStr = 'NEW';
      } else if (comp.rank_change === 0) {
        rankChangeStr = '-';
      } else if (comp.rank_change! > 0) {
        rankChangeStr = `↑${comp.rank_change}`;
      } else {
        rankChangeStr = `↓${Math.abs(comp.rank_change!)}`;
      }

      const value = this.formatNumber(comp.current_value);
      const growth = comp.value_growth_pct !== null
        ? `${comp.value_growth_pct >= 0 ? '+' : ''}${comp.value_growth_pct.toFixed(1)}%`
        : 'N/A';
      const share = `${comp.market_share_value.toFixed(1)}%`;

      lines.push(`| ${rank} | ${name} | ${rankChangeStr} | ${value} | ${growth} | ${share} |`);
    }

    lines.push('');
    lines.push(`_报告生成时间: ${new Date().toLocaleString('zh-CN')}_`);

    return lines.join('\n');
  }

  generateSummaryStats(year: number, marketType: MarketType): SummaryStats {
    const allData = this.db.getBrokerDataByYear(year, marketType);
    const top10 = this.db.getTopBrokers(year, marketType, 10);

    const totalValue = allData.reduce((sum, d) => sum + d.total_value, 0);
    const top10Value = top10.reduce((sum, d) => sum + d.total_value, 0);
    const top10Share = totalValue > 0 ? (top10Value / totalValue) * 100 : 0;

    return {
      year,
      marketType,
      totalValue,
      top10Value,
      top10Share,
      brokerCount: allData.length,
    };
  }

  private getMarketTypeName(marketType: MarketType): string {
    switch (marketType) {
      case 'main':
        return '主板 (Main Market)';
      case 'nomu':
        return '创业板 (Nomu - Parallel Market)';
      case 'all':
        return '全部市场';
      default:
        return marketType;
    }
  }

  private formatNumber(value: number): string {
    if (value >= 1e9) {
      return `${(value / 1e9).toFixed(2)}B`;
    } else if (value >= 1e6) {
      return `${(value / 1e6).toFixed(2)}M`;
    } else if (value >= 1e3) {
      return `${(value / 1e3).toFixed(2)}K`;
    }
    return value.toFixed(0);
  }
}
