# zyes

zyes 是一款专为多设备开发者打造的轻量级、跨设备书签跳转与聚合搜索门户。

一份前端（Svelte 5 + Vite + Tailwind v4），两套等价后端：

- **`server/`** — Fastify 5 + TypeScript + 文件 JSON 存储（`server/data/data.json`）。适合自托管 / VPS / Docker，零外部依赖。
- **`worker/`** — Hono on Cloudflare Workers + D1（SQLite）。无服务器、边缘加速、免运维。

两套后端共享同一份 `src/lib/types.ts` 契约与同一份前端 `src/`，请求/响应体完全一致，可按需切换部署形态。

---

## Node 后端（`server/`）

```bash
npm install
npm run dev        # 同时起前端 (5173) + 后端 (3847)
# 首次运行会自动初始化，默认密码输出在控制台；或用 ZYES_PASSWORD / ZYES_PORT 覆盖
npm run build && npm start
```

数据写在 `server/data/data.json` / `config.json`。生产环境用 `ZYES_DATA_DIR` 指定持久化目录（如 Docker 卷）。

---

## Cloudflare Workers 后端（`worker/`）

### 一次性准备

```bash
npm install
npm run db:create              # 创建 D1 数据库，把输出的 database_id 填进 wrangler.toml
npm run db:migrate             # 建表（remote）
npm run seed:engines           # 播种 4 个搜索引擎 + 默认 all_view_mode（remote）
wrangler secret put JWT_SECRET # 交互输入一段随机串（>= 32 字节）
npm run set-password -- --execute | bash   # 设置登录密码（PBKDF2 哈希写入 D1 meta）
```

本地调试时把 `db:migrate` / `seed:engines` 换成 `db:migrate:local` / `seed:engines:local`，`wrangler dev` 会用本地 D1。

### 迁移已有 Node 数据

```bash
npm run import-d1 > sql/import.sql
wrangler d1 execute zyes-db --remote --file=sql/import.sql
```

`import-d1` 会读 `server/data/data.json`，回填缺失字段（`openTarget`/`displayMode`/`allViewMode`），输出 categories / bookmarks / search_engines / settings 的 `INSERT` 语句。

### 开发与部署

```bash
npm run dev:worker             # wrangler dev（本地 Worker + 本地 D1）→ http://127.0.0.1:8787
npm run dev:worker:client      # 同时起 Worker + Vite(HMR 前端)，前端 dev 代理 /api → Worker
npm run build                  # 构建前端到 dist/client，供 Worker [assets] 托管
npm run deploy                 # wrangler deploy 上线
npm run cf-typecheck           # 仅类型检查 worker/
```

> **两种 dev 形态连同一个 Vite 前端**：
> - 连 Node 后端：`npm run dev`（Vite dev 代理 `/api` → `localhost:3847`，默认）
> - 连 Worker 后端：`npm run dev:worker:client`（Vite 自动把代理切到 `127.0.0.1:8787`，靠 `VITE_API_TARGET` env 控制；也可单独 `VITE_API_TARGET=http://127.0.0.1:8787 npm run dev:client`）

构建前端后才部署：`worker/src/index.ts` 的 `app.get('*')` 用 `env.ASSETS` 把非 `/api` 路径回退到 `dist/client` 的 SPA。

### 前端 API 地址

`src/lib/api.ts` 读取 `import.meta.env.VITE_API_BASE`，默认空（同域）。Workers 形态下前端与 Worker 同域，无需配置；如把前端单独上 Cloudflare Pages、后端 Worker 用独立域名，则 `VITE_API_BASE=https://api.your-domain` 构建即可。

---

## 关于密码与鉴权

- **Node**：bcrypt(SALT=12) + JWT，密钥存 `config.json`。
- **Workers**：PBKDF2-SHA256（100k 轮，Web Crypto）+ jose HS256，密钥存 Workers Secret（`JWT_SECRET`），密码哈希存 D1 `meta` 表。从 Node 迁移时密码需重新设置一次（bcrypt 哈希不在 Worker 端校验）。

## 脚本

| 命令 | 说明 |
|---|---|
| `npm run dev` | Node 形态本地开发（前端 + 后端） |
| `npm run dev:worker` | Worker 形态本地开发 |
| `npm run db:create` | 创建 D1 数据库 |
| `npm run db:migrate` / `db:migrate:local` | 应用 schema |
| `npm run seed:engines` / `seed:engines:local` | 播种搜索引擎 |
| `npm run set-password` | 生成设置密码的 SQL（含 `--execute` 一键） |
| `npm run import-d1` | 从 Node data.json 导出 D1 导入 SQL |
| `npm run deploy` | 部署 Worker |
| `npm run cf-typecheck` | Worker 类型检查 |
