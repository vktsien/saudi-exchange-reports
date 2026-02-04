---
name: saudi-exchange
description: Saudi Exchange member trading reports downloader and broker ranking analyzer
license: MIT
compatibility: ">=1.0.0"
metadata:
  author: Soverlink
  version: "1.0.0"
  category: finance
  tags:
    - saudi-exchange
    - broker-ranking
    - trading-reports
    - finance
skills:
  - download-reports
  - broker-report
allowed-tools:
  - Bash
  - Read
  - Write
---

# Saudi Exchange Reports Plugin

沙特交易所会员交易报告下载与Broker排名分析工具。

## Available Skills

| 技能名称 | 说明 |
|---------|------|
| `/saudi-exchange:download-reports` | 下载年报数据并导入数据库 |
| `/saudi-exchange:broker-report` | 生成Broker排名环比对比表 |

## /saudi-exchange:download-reports

下载沙特交易所年度会员交易报告，并将数据导入数据库。

```bash
cd /home/ubuntu/.claude/plugins/cache/local-plugins/saudi-exchange/1.0.0/scripts
npx ts-node download-reports.ts --import-from-csv ../data/sample_broker_data.csv
```

### Parameters

| 参数 | 说明 | 默认值 |
|-----|------|-------|
| `--output <dir>` | 下载文件保存目录 | `./data/reports` |
| `--years <years>` | 要下载的年份(逗号分隔) | `2023,2024` |
| `--force` | 强制重新下载 | `false` |
| `--import-from-csv <file>` | 从CSV文件导入数据 | - |

## /saudi-exchange:broker-report

生成排名前N的Broker对比环比表，支持主板/创业板/全部市场。

```bash
cd /home/ubuntu/.claude/plugins/cache/local-plugins/saudi-exchange/1.0.0/scripts
npx ts-node generate-broker-report.ts --current-year 2024 --previous-year 2023 --market main --top 10
```

### Parameters

| 参数 | 说明 | 默认值 |
|-----|------|-------|
| `--output <file>` | 输出文件路径 | `./broker-report.md` |
| `--current-year <year>` | 当前年份 | 当前年份 |
| `--previous-year <year>` | 对比年份 | 上一年 |
| `--market <type>` | 市场类型: `main`/`nomu`/`all` | `main` |
| `--top <n>` | Top N Broker数量 | `10` |
| `--format <type>` | 输出格式: `markdown`/`json` | `markdown` |

### Market Types

- `main` - 主板 (Main Market)
- `nomu` - 创业板 (Nomu - Parallel Market)
- `all` - 全部市场

## CSV Data Format

```csv
year,broker_name,broker_rank,market_type,buy_value,sell_value,total_value,buy_volume,sell_volume,total_volume,market_share_value,market_share_volume
2024,Al Rajhi Capital,1,main,100000000,95000000,195000000,5000000,4800000,9800000,15.5,14.2
```

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
