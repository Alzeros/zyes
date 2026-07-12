# Zyes

Zyes 是一款专为多设备开发者打造的轻量级、跨设备书签跳转与聚合搜索门户。

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

### Deploy to Cloudflare 按钮（一键体验）

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Alzeros/zyes)

点击按钮后：
1. Cloudflare 自动创建仓库并部署 Worker（注意：**非 fork，无法 sync 更新**）。
2. 表单填两个 Text 变量（`ZYES_PASSWORD` = 你的登录密码，`JWT_SECRET` = 随机串）。
3. 部署完成后在 CF 控制台绑定 D1 + 访问 `/api/init` 建表。
4. 打开 Worker 域名，用你设的密码登录。

> **此路径不能 Sync 更新。** 需要跟踪本仓库后续更新请走下面 Fork 路径。

### Fork 手动部署（推荐，支持 Sync 更新）

```bash
# 1. Fork 本仓库 & clone
# 2. Cloudflare 控制台 → 创建 D1 数据库（记住名字）
# 3. 在 Worker 控制台 Settings → Bindings → 添加 D1，名字填 DB
# 4. 添加两个 Text 变量：JWT_SECRET（openssl rand -hex 32 生成）+ ZYES_PASSWORD
# 5. push 任意改动（或直接 CF 里 rebuild）→ 自动部署
# 6. 第一次访问 /api/init → 自动建表+播种
# 7. 打开 Worker 域名，用 ZYES_PASSWORD 登录
```

> ✅ Fork 保留 GitHub fork 关系，主仓库更新后点 **Sync fork** 拉取更新，CF 自动 rebuild。

### 初始化数据库 — 访问 `/api/init`

绑定 D1 后**只需一次**：浏览器打开 `你的Worker域名/api/init`，Worker 自动创建所有表、播种 4 个默认搜索引擎、写默认设置。所有 SQL 都带 `IF NOT EXISTS`/`ON CONFLICT`，重复调用幂等。

GET `/api/init` 可查看是否已完成初始化。

### 迁移已有 Node 数据（可选）

```bash
npm run import-d1 > sql/import.sql
# 把 sql/import.sql 粘贴到 D1 控制台 SQL 编辑器执行
```

### 开发与部署命令速查

```bash
npm run dev:worker             # wrangler dev (wrangler.dev.toml) → http://127.0.0.1:8787
npm run dev:worker:client      # 同时起 Worker + Vite(HMR 前端)，代理 /api → Worker
npm run build                  # 构建前端到 dist/client
npm run deploy                 # wrangler deploy（D1 已从 toml 移除，控制台绑定）
npm run cf-typecheck           # 仅类型检查 worker/
```

本地开发用 `wrangler.dev.toml`：包含本地 D1 绑定（`database_id: "local-dev"`），`wrangler dev` 自动创嵌入式 SQLite。`dev:worker` 脚本已指向这个 dev 配置。

> **两种 dev 形态连同一个 Vite 前端**：
> - 连 Node 后端：`npm run dev`（Vite dev 代理 `/api` → `localhost:3847`，默认）
> - 连 Worker 后端：`npm run dev:worker:client`（Vite 自动把代理切到 `127.0.0.1:8787`，靠 `VITE_API_TARGET` env 控制；也可单独 `VITE_API_TARGET=http://127.0.0.1:8787 npm run dev:client`）

构建前端后才部署：`worker/src/index.ts` 的 `app.get('*')` 用 `env.ASSETS` 把非 `/api` 路径回退到 `dist/client` 的 SPA。

### 前端 API 地址

`src/lib/api.ts` 读取 `import.meta.env.VITE_API_BASE`，默认空（同域）。Workers 形态下前端与 Worker 同域，无需配置；如把前端单独上 Cloudflare Pages、后端 Worker 用独立域名，则 `VITE_API_BASE=https://api.your-domain` 构建即可。

---

## 关于密码与鉴权

- **Node**：bcrypt(SALT=12) + JWT，密钥存 `config.json`。
- **Workers**：登录密码直接读 Worker 变量 `ZYES_PASSWORD`（明文比对，常数时间），JWT 用 jose HS256，密钥存 Worker 变量 `JWT_SECRET`。fork 部署时只需在控制台填这两个变量，无需跑任何密码脚本。从 Node 迁移时密码在 Worker 侧重新设即可。

## 脚本

| 命令 | 说明 |
|---|---|
| `npm run dev` | Node 形态本地开发（前端 + 后端） |
| `npm run dev:worker` | Worker 形态本地开发 (wrangler.dev.toml) |
| `npm run dev:worker:client` | Worker 后端 + Vite 前端（HMR）一起起 |
| `npm run import-d1` | 从 Node data.json 导出 D1 导入 SQL |
| `npm run deploy` | wrangler deploy（D1 绑定在控制台） |
| `npm run cf-typecheck` | Worker 类型检查 |