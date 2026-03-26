# RSSHub Fork - 本地开发与测试指南

## 项目概述

这是 RSSHub 的自定义 fork，主要用于订阅抖音、B站等平台的内容。

## 环境要求

- Node.js: `^22.20.0` 或 `^24`
- pnpm: `10.32.1`
- Chrome 浏览器（用于 Puppeteer）

## 本地启动

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

复制并编辑 `.env` 文件，主要配置：

```bash
# 抖音 Cookie（必须，用于获取用户视频）
DOUYIN_COOKIE=你的抖音Cookie

# 服务端口（默认 1200）
PORT=1200

# 缓存类型（可选，本地测试可不用）
# CACHE_TYPE=redis
# REDIS_URL=redis://localhost:6379
```

### 3. 开发模式启动

```bash
# 开发模式（带热重载）
pnpm dev

# 或者生产模式
pnpm start
```

服务启动后访问: http://localhost:1200

## 本地测试订阅

### 抖音博主

```bash
# 产品君
curl "http://localhost:1200/douyin/user/MS4wLjABAAAAVmG_pTXp3pvTEwF7Cm3te2-s_RDjXsCMf3n4sgs-63u-0xRsmvBdm6gj3rjNKaR-"

# 大道AI
curl "http://localhost:1200/douyin/user/MS4wLjABAAAAeVHxw6X16RMnc11ksnW-RBN8ma_XvVRKjI2gAOGPzDw"

# github优品
curl "http://localhost:1200/douyin/user/MS4wLjABAAAArw0xtUB5bCpMX2ZGOfY5l-THB1d98A3SEhv1UvpnA6al3c-mraA0HgXTC1OfVzuL"
```

### B站合集

```bash
# 橘鸦AI日报
curl "http://localhost:1200/bilibili/user/collection/285286947/5033217/true/1"
```

## 核心路由文件

| 文件 | 说明 |
|------|------|
| `lib/routes/douyin/user.ts` | 抖音博主订阅（使用 Puppeteer） |
| `lib/routes/douyin/hashtag.ts` | 抖音话题 |
| `lib/routes/douyin/live.ts` | 抖音直播 |
| `lib/routes/bilibili/` | B站相关路由 |

## 测试命令

```bash
# 运行所有测试
pnpm test

# 运行特定路由测试
pnpm vitest routes/douyin

# 代码格式检查
pnpm format:check

# 代码修复
pnpm format
```

## 关键配置说明

### 抖音 Cookie 获取

1. 登录 https://www.douyin.com
2. 打开浏览器开发者工具 (F12)
3. 切换到 Network 标签
4. 刷新页面，找到任意请求
5. 复制请求头中的 Cookie 值

### Puppeteer 配置

抖音路由需要 Puppeteer 来绕过反爬。默认会自动下载 Chrome。

如果遇到问题，可以手动安装：

```bash
npx puppeteer browsers install chrome
```

## 常见问题

### 1. 抖音返回空数据

- Cookie 可能已过期，需要重新获取
- 检查 Cookie 是否完整

### 2. Puppeteer 启动失败

- 确保 Chrome 已安装
- Windows 上可能需要配置 `PUPPETEER_EXECUTABLE_PATH` 环境变量

### 3. 端口被占用

修改 `.env` 中的 `PORT` 配置

## 与 douyin-transcriber 联动

启动 RSSHub 后，修改 `douyin-transcriber/config.py` 中的 RSSHUB_URL：

```python
RSSHUB_URL = "http://localhost:1200"
```

或设置环境变量：

```bash
RSSHUB_URL=http://localhost:1200
```
