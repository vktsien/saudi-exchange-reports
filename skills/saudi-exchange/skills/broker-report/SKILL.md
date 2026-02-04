---
name: broker-report
description: Generate Saudi Exchange top broker ranking comparison report with year-over-year changes
license: MIT
compatibility: ">=1.0.0"
metadata:
  author: Soverlink
  version: "1.0.0"
  category: finance
allowed-tools:
  - Bash
  - Read
  - Write
---

# Saudi Exchange Broker Ranking Report

生成沙特交易所排名前N的Broker对比环比表，按年环比显示排名升降和业务量。

## Usage

```bash
cd /home/ubuntu/.claude/plugins/cache/local-plugins/saudi-exchange/1.0.0/scripts
npx ts-node generate-broker-report.ts --current-year 2024 --previous-year 2023 --market main --top 10
```

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `--output <file>` | No | Output file path (default: ./broker-report.md) |
| `--current-year <year>` | No | Current year to compare (default: current year) |
| `--previous-year <year>` | No | Previous year to compare (default: last year) |
| `--market <type>` | No | Market type: `main`, `nomu`, or `all` (default: main) |
| `--top <n>` | No | Number of top brokers (default: 10) |
| `--format <type>` | No | Output format: `markdown` or `json` (default: markdown) |

## Market Types

- `main` - 主板 (Main Market)
- `nomu` - 创业板 (Nomu - Parallel Market)
- `all` - 全部市场

## Output Example

```markdown
# 沙特交易所 Broker 排名对比报告

**对比年份**: 2023 → 2024
**市场类型**: 主板 (Main Market)
**Top 10 总交易额增长**: 16.02%

| 排名 | Broker名称 | 排名变化 | 交易额(SAR) | 增长率 | 市场份额 |
|:----:|:-----------|:--------:|------------:|-------:|--------:|
| 1 | Al Rajhi Capital | - | 202.00B | +13.5% | 14.8% |
| 2 | Riyad Capital | ↑1 | 188.00B | +27.0% | 13.8% |
| 3 | SNB Capital | ↓1 | 174.00B | +7.4% | 12.8% |
| 9 | Albilad Capital | NEW | 90.00B | N/A | 6.6% |
```

## Examples

```bash
# Main market top 10
npx ts-node generate-broker-report.ts --market main --top 10

# Nomu market top 5
npx ts-node generate-broker-report.ts --market nomu --top 5

# All markets JSON output
npx ts-node generate-broker-report.ts --market all --format json
```
