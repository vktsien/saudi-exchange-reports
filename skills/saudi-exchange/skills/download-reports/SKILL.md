---
name: download-reports
description: Download Saudi Exchange annual member trading reports and import data to database
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

# Saudi Exchange Reports Downloader

从沙特交易所下载年度会员交易报告，并将数据导入数据库。

## Usage

```bash
cd /home/ubuntu/.claude/plugins/cache/local-plugins/saudi-exchange/1.0.0/scripts
npx ts-node download-reports.ts --years 2023,2024
```

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `--output <dir>` | No | Output directory for downloaded files (default: ./data/reports) |
| `--years <years>` | No | Years to download, comma-separated (default: 2023,2024) |
| `--force` | No | Force re-download existing files |
| `--import-from-csv <file>` | No | Import data from CSV file |

## CSV Format

```csv
year,broker_name,broker_rank,market_type,buy_value,sell_value,total_value,buy_volume,sell_volume,total_volume,market_share_value,market_share_volume
2024,Al Rajhi Capital,1,main,100000000,95000000,195000000,5000000,4800000,9800000,15.5,14.2
```

## Example

```bash
# Download reports
npx ts-node download-reports.ts --years 2023,2024

# Import from CSV
npx ts-node download-reports.ts --import-from-csv ./data/broker_data.csv
```
