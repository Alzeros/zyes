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
3. 部署时自动 provision 一个 D1 数据库 `zyes-db`（无需手动创建、无需手绑定）。
4. 打开 Worker 域名，首次请求时 Worker **自动建表 + 播种**（schema 自愈，见下文），用你设的密码登录。

> **此路径不能 Sync 更新。** 需要跟踪本仓库后续更新请走下面 Fork 路径。

### Fork 手动部署（推荐，支持 Sync 更新）

```bash
# 1. Fork 本仓库 & clone
# 2. Cloudflare 控制台：Workers & Pages → Create → Workers → Git 导入你的 fork
#    构建命令：npm run build      部署命令：npm run deploy
#    添加两个 Text 变量：JWT_SECRET（openssl rand -hex 32 生成）+ ZYES_PASSWORD（你的登录密码）
# 3. push 到你的 fork → Cloudflare 自动部署
#    首次 deploy 时 wrangler 会自动 provision D1 数据库 zyes-db 并绑定，无需手动创建
# 4. 打开 Worker 域名，首次请求自动建表+播种，用 ZYES_PASSWORD 登录
```

> ✅ Fork 保留 GitHub fork 关系，主仓库更新后点 **Sync fork** 拉取更新，CF 自动 rebuild。
> ✅ D1 绑定写在 `wrangler.toml` 里（省略 `database_id`），由 wrangler 4.x 自动 provision，**deploy 不会清掉绑定或变量**（`deploy` 脚本带 `--keep-vars`）。

### Schema 自动迁移（无需手动跑 `/api/init`）

`wrangler deploy` 只部署代码，**不会执行 D1 迁移**——这会让「新代码 + 旧表结构」不同步，写入失败。为此 Worker 在**每次冷启动的第一个请求**自动运行 `ensureSchema`：按 `meta.schema_version` 版本号把 D1 补齐到代码期望的状态，补完才放行到业务路由。

- fork 者点 Deploy 按钮 / Sync 更新后重新部署 → 首次请求自动建表、补列，**零配置、零 secret、零 CI**。
- `migrations/*.sql` 仍保留给想用 `wrangler d1 migrations apply` 的高级用户，但不再是部署依赖。
- `/api/init` 端点保留为手动「立即迁移 + 查看结果」的诊断入口（公开，无需登录）：`POST /api/init` 强制跑一遍，`GET /api/init` 查当前版本。

以后改 schema：在 `worker/src/migrations.ts` 的 `MIGRATIONS` 数组**末尾追加**一项 `{ v, run }` 并把 `TARGET_SCHEMA_VERSION` bump——只追加不修改（老库可能正停在那个版本）。

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
npm run deploy                 # wrangler deploy --keep-vars（D1 自动 provision,变量保留）
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

## 数据导入 / 导出

设置面板（齿轮 → 数据）支持三种数据操作，**两套后端行为一致**：

| 操作 | 格式 | 用途 |
|---|---|---|
| **导出 JSON** | zyes 自有快照 | 无损备份，含分类/书签/设置，可完整还原 |
| **导入 JSON** | 同上 | 覆盖恢复（导入前自动备份当前数据到 `.bak` / `meta` 表） |
| **导出 HTML** | NETSCAPE-Bookmark-file-1 | 浏览器通用格式，可导入回 Chrome/Firefox/Edge/Safari |
| **导入 HTML** | NETSCAPE-Bookmark-file-1 | 从浏览器书签迁入，支持**覆盖**或**追加**两种模式 |

### NETSCAPE 书签互通

导出 HTML 遵循浏览器通用的 NETSCAPE-Bookmark-file-1 标准：

- **从浏览器迁入**：浏览器「导出书签」得到 HTML → zyes「从浏览器书签导入」。顶层文件夹 → 分类；子文件夹里的书签**扁平化**进最近的顶层父分类（zyes 无嵌套分类）；根目录书签 → 未分类。导入时丢弃 base64 icon，由 zyes 的图标代理自动重新获取。
- **迁回浏览器**：zyes「导出 HTML 书签」→ 浏览器「导入书签」选该文件。不被锁定。
- **导入模式**：HTML 导入时可选「覆盖」（清空当前数据后写入，导入前自动备份）或「追加」（保留现有数据、分类按名复用、书签追加，可能产生重复 URL）。

JSON 是 zyes 的无损备份格式（含设置、保留原始 id），HTML 是浏览器互通格式（仅书签和分类，不含设置）。两者都覆盖前自动备份，恢复见下文。

### 备份与恢复

- **Node**：导入前自动把 `data.json` 复制成 `data.json.bak`（最近一次）。恢复：`cp data.json.bak data.json` 后重启。
- **Worker**：导入前自动把当前快照存入 D1 `meta` 表（键 `backup_<时间戳>`，保留最近 5 份）。恢复：`wrangler d1 execute zyes-d1 --remote --command "SELECT value FROM meta WHERE key='backup_XXX'"` 取出 JSON 后手动导入。

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