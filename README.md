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

### 一键部署（推荐，无需 CLI）

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Alzeros/zyes)

点击上方按钮后：

1. Cloudflare 自动 fork 模板 / 用你的仓库，**自动创建 D1 数据库**并绑定到 Worker（`database_id` 占位由按钮回写真实 id）。
2. `package.json` 的 `deploy` 脚本会先跑 `wrangler d1 migrations apply DB --remote`（自动建表 + 播种），再 `wrangler deploy`。**fork 者无需手动建表、无需粘 SQL**。
3. 按钮流程会引导你填两个 Worker 变量：
   - `JWT_SECRET` — 随机串（≥ 32 字节），用于签发登录 token
   - `ZYES_PASSWORD` — 你想用的登录密码
4. 部署完成后访问 Worker 域名，用 `ZYES_PASSWORD` 登录即可。

> Fork 者把仓库 fork 到自己账号后，把按钮 URL 里的 `Alzeros/zyes` 换成 `你的用户名/zyes` 再点。

### 手动部署（CLI / 已有 Cloudflare 账号）

```bash
npm install
npm run db:create               # 创建 D1 数据库，按钮路径不必跑这步
npm run deploy                  # = wrangler d1 migrations apply DB --remote && wrangler deploy
# 在 Cloudflare 控制台该 Worker 的 Settings → Variables 中设置：
#   JWT_SECRET  = 随机串（>= 32 字节）
#   ZYES_PASSWORD = 你的登录密码
```

本地调试：`npm run db:migrations:apply:local`（建表）、`npm run dev:worker`（本地 Worker + 本地 D1），并在项目根放一个 `.dev.vars`（参考 `.dev.vars.example`）填 `JWT_SECRET` + `ZYES_PASSWORD`。

### 迁移已有 Node 数据（可选）

```bash
npm run import-d1 > sql/import.sql
wrangler d1 execute zyes-db --remote --file=sql/import.sql
```

`import-d1` 会读 `server/data/data.json`，回填缺失字段（`openTarget`/`displayMode`/`allViewMode`），输出 categories / bookmarks / search_engines / settings 的 `INSERT` 语句。密码请单独在 Worker 变量 `ZYES_PASSWORD` 中设置（不再走 D1 meta）。

### 开发与部署命令速查

```bash
npm run dev:worker             # wrangler dev（本地 Worker + 本地 D1）→ http://127.0.0.1:8787
npm run dev:worker:client      # 同时起 Worker + Vite(HMR 前端)，前端 dev 代理 /api → Worker
npm run build                  # 构建前端到 dist/client，供 Worker [assets] 托管
npm run deploy                 # 远程迁移 + 部署线上
npm run db:migrations:apply    # 单独应用远程迁移（deploy 已含此步，幂等）
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
- **Workers**：登录密码直接读 Worker 变量 `ZYES_PASSWORD`（明文比对，常数时间），JWT 用 jose HS256，密钥存 Worker 变量 `JWT_SECRET`。fork 部署时只需在控制台填这两个变量，无需跑任何密码脚本。从 Node 迁移时密码在 Worker 侧重新设即可。

## 脚本

| 命令 | 说明 |
|---|---|
| `npm run dev` | Node 形态本地开发（前端 + 后端） |
| `npm run dev:worker` | Worker 形态本地开发 |
| `npm run dev:worker:client` | Worker 后端 + Vite 前端（HMR）一起起 |
| `npm run db:create` | 创建 D1 数据库（一键部署不必跑） |
| `npm run db:migrations:apply` / `:local` | 应用迁移（建表+种子，幂等） |
| `npm run db:migrate` / `:local` | 旧式直接执行 0001_init.sql（兼容保留） |
| `npm run seed:engines` / `:local` | 旧式直接执行种子 SQL（兼容保留） |
| `npm run import-d1` | 从 Node data.json 导出 D1 导入 SQL |
| `npm run deploy` | 远程迁移 + 部署线上（= migrations apply && wrangler deploy） |
| `npm run cf-typecheck` | Worker 类型检查 |
