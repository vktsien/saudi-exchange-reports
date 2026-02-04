---
name: saudi-exchange
description: Download Saudi Exchange member trading reports and generate broker ranking comparison tables
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
allowed-tools:
  - Bash
  - Read
  - Write
---

# Saudi Exchange Reports Skill

从沙特交易所下载会员交易年报数据，并生成排名前10的Broker对比环比表。

## 功能

1. **下载年报** - 从沙特交易所网站下载年度会员交易报告
2. **生成排名报告** - 生成Broker排名年环比对比表

## 快速使用

### 下载报告数据

```bash
cd /home/ubuntu/saudi-exchange-reports/skills/saudi-exchange/scripts
npx ts-node download-reports.ts --years 2023,2024
```

### 从CSV导入数据

```bash
npx ts-node download-reports.ts --import-from-csv ./data/broker_data.csv
```

### 生成Broker排名对比报告

```bash
npx ts-node generate-broker-report.ts --current-year 2024 --previous-year 2023 --market main --top 10
```

## 参数说明

### download-reports.ts

| 参数 | 说明 | 默认值 |
|-----|------|-------|
| `--output <dir>` | 下载文件保存目录 | `./data/reports` |
| `--years <years>` | 要下载的年份(逗号分隔) | `2023,2024` |
| `--force` | 强制重新下载已存在的文件 | `false` |
| `--import-from-csv <file>` | 从CSV文件导入数据 | - |

### generate-broker-report.ts

| 参数 | 说明 | 默认值 |
|-----|------|-------|
| `--output <file>` | 输出文件路径 | `./broker-report.md` |
| `--current-year <year>` | 当前年份 | 当前年份 |
| `--previous-year <year>` | 对比年份 | 上一年 |
| `--market <type>` | 市场类型: `main`/`nomu`/`all` | `main` |
| `--top <n>` | Top N Broker数量 | `10` |
| `--format <type>` | 输出格式: `markdown`/`json` | `markdown` |

## 市场类型

- `main` - 主板 (Main Market)
- `nomu` - 创业板/平行市场 (Nomu - Parallel Market)
- `all` - 全部市场

## CSV数据格式

如需手动导入数据，CSV文件格式如下：

```csv
year,broker_name,broker_rank,market_type,buy_value,sell_value,total_value,buy_volume,sell_volume,total_volume,market_share_value,market_share_volume
2024,Al Rajhi Capital,1,main,100000000,95000000,195000000,5000000,4800000,9800000,15.5,14.2
2024,SNB Capital,2,main,90000000,85000000,175000000,4500000,4300000,8800000,13.8,12.5
```

## 输出示例

```markdown
# 沙特交易所 Broker 排名对比报告

**对比年份**: 2023 → 2024
**市场类型**: 主板 (Main Market)
**Top 10 总交易额增长**: 15.23%

**最大升幅**: Riyad Capital (↑2名)
**最大跌幅**: HSBC Saudi (↓1名)
**跌出Top 10**: Deutsche Bank

| 排名 | Broker名称 | 排名变化 | 交易额(SAR) | 增长率 | 市场份额 |
|:----:|:-----------|:--------:|------------:|-------:|--------:|
| 1 | Al Rajhi Capital | - | 200.00M | +11.1% | 15.5% |
| 2 | Riyad Capital | ↑2 | 190.00M | +35.7% | 14.8% |
| 3 | SNB Capital | ↓1 | 170.00M | +6.3% | 13.2% |
```

## 注意事项

1. 沙特交易所网站有反爬虫保护，可能需要手动下载PDF报告
2. 手动下载后，可从PDF中提取数据并导入CSV
3. 数据存储在SQLite数据库中，位于 `./data/saudi_exchange.db`
