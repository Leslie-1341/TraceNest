import { and, desc, eq, like, ne, or } from "drizzle-orm";
import { getD1, getDb } from "../../../db";
import { memoryItems } from "../../../db/schema";
import { analyzeContent, canonicalizeUrl, extractWebPage, fingerprintContent, looksLikeUrl } from "../../../lib/content-pipeline";

const demoItems = [
  ["异步预取设计", "记录了在 OS 大赛中实现异步预取的思路与细节，包括 KV Cache 的分层管理与预取时机策略。", "项目笔记", "笔记", "用于完善 KV Cache 异步预取方案", ["系统优化", "KV Cache", "代码"], "OS 大赛", "sage", "芯"],
  ["低美术成本的游戏机制", "通过机制驱动体验的八个设计方向，减少美术资源依赖，同时保持原型的视觉辨识度。", "B站视频", "视频", "为 Game Jam 寻找轻量玩法参考", ["游戏设计", "灵感"], "GMTK Game Jam", "amber", "玩"],
  ["个人知识库的收集闭环", "从收集、处理、关联到回顾，讨论如何建立可持续的个人知识系统。", "网页文章", "文章", "拾迹产品架构参考", ["知识管理", "产品"], "拾迹", "sage", "环"],
  ["CopyCat-BCI/research", "脑机接口研究工具仓库，包含数据预处理和实验管线。", "GitHub 仓库", "代码", "后续调研时查看实现", ["GitHub", "研究"], null, "ink", "GH"],
  ["操作系统内存管理简明教程", "以可视化方式讲解分页、缺页和内存换出的核心概念。", "B站视频", "视频", "补齐分页管理基础", ["操作系统", "学习"], null, "coral", "B"],
  ["LLM 推理优化：连续批处理实践", "连续批处理的调度方式、吞吐收益和首 token 延迟之间的权衡。", "网页文章", "文章", "作为性能实验的设计依据", ["LLM", "推理优化"], "OS 大赛", "blue", "网"],
  ["截图 OCR 识别", "关于端侧 OCR 与增量截图识别的产品讨论截图。", "本地截图", "截图", "用于拾迹截图收件箱设计", ["OCR", "资料"], "拾迹", "ink", "图"],
] as const;

function present(row: typeof memoryItems.$inferSelect) {
  let tags: string[] = [];
  try { tags = JSON.parse(row.tags) as string[]; } catch { tags = []; }
  return { ...row, tags, time: relativeTime(row.createdAt) };
}

function relativeTime(value: string) {
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  const hours = Math.max(0, Math.floor((Date.now() - date.getTime()) / 3_600_000));
  if (hours < 1) return "刚刚";
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "昨天" : days < 7 ? `${days} 天前` : `${Math.floor(days / 7)} 周前`;
}

async function seedIfEmpty() {
  const db = getDb();
  if ((await db.select({ id: memoryItems.id }).from(memoryItems).limit(1)).length) return;
  await db.insert(memoryItems).values(demoItems.map(([title, summary, source, kind, reason, tags, project, color, glyph], index) => ({
    title, content: summary, summary, source, kind, reason, tags: JSON.stringify(tags), project, color, glyph,
    status: "inbox", processingStatus: "ready",
    createdAt: new Date(Date.now() - index * 86_400_000).toISOString(), updatedAt: new Date().toISOString(),
  })));
}

const extraColumns: Record<string, string> = {
  original_url: "TEXT", canonical_url: "TEXT", content_hash: "TEXT", author: "TEXT", site_name: "TEXT",
  duplicate_of_id: "INTEGER", processing_error: "TEXT", ai_provider: "TEXT",
};

async function ensureSchema() {
  const d1 = getD1();
  await d1.prepare(`CREATE TABLE IF NOT EXISTS memory_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT '手动记录', kind TEXT NOT NULL DEFAULT '笔记',
    reason TEXT NOT NULL DEFAULT '', tags TEXT NOT NULL DEFAULT '[]', project TEXT, color TEXT NOT NULL DEFAULT 'sage',
    glyph TEXT NOT NULL DEFAULT '记', status TEXT NOT NULL DEFAULT 'inbox', processing_status TEXT NOT NULL DEFAULT 'ready',
    original_url TEXT, canonical_url TEXT, content_hash TEXT, author TEXT, site_name TEXT, duplicate_of_id INTEGER,
    processing_error TEXT, ai_provider TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  const info = await d1.prepare("PRAGMA table_info(memory_items)").all<{ name: string }>();
  const known = new Set((info.results || []).map(column => column.name));
  for (const [name, definition] of Object.entries(extraColumns)) {
    if (!known.has(name)) await d1.prepare(`ALTER TABLE memory_items ADD COLUMN ${name} ${definition}`).run();
  }
  await d1.prepare("CREATE UNIQUE INDEX IF NOT EXISTS memory_items_canonical_url_idx ON memory_items (canonical_url)").run();
  await d1.prepare("CREATE INDEX IF NOT EXISTS memory_items_content_hash_idx ON memory_items (content_hash)").run();
  await d1.prepare("CREATE INDEX IF NOT EXISTS memory_items_status_idx ON memory_items (status)").run();
}

function visualFor(kind: string) {
  if (kind === "代码") return { color: "ink", glyph: "GH" };
  if (kind === "视频") return { color: "coral", glyph: "播" };
  if (kind === "待办") return { color: "amber", glyph: "办" };
  if (kind === "日记") return { color: "coral", glyph: "日" };
  if (kind === "文章") return { color: "blue", glyph: "网" };
  return { color: "sage", glyph: "记" };
}

function withExtensionCors(request: Request, response: Response) {
  const origin = request.headers.get("origin") || "";
  if (!/^(chrome|edge)-extension:\/\/[a-z]{32}$/i.test(origin)) return response;
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-credentials", "true");
  headers.set("access-control-allow-headers", "content-type");
  headers.set("access-control-allow-methods", "GET, POST, PATCH, OPTIONS");
  headers.append("vary", "Origin");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function OPTIONS(request: Request) {
  return withExtensionCors(request, new Response(null, { status: 204 }));
}

export async function GET(request: Request) {
  try {
    await ensureSchema();
    await seedIfEmpty();
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim() ?? "";
    const status = url.searchParams.get("status")?.trim() ?? "";
    const filters = [];
    if (query) filters.push(or(like(memoryItems.title, `%${query}%`), like(memoryItems.content, `%${query}%`), like(memoryItems.summary, `%${query}%`), like(memoryItems.tags, `%${query}%`), like(memoryItems.canonicalUrl, `%${query}%`))!);
    if (status) filters.push(eq(memoryItems.status, status));
    const where = filters.length > 1 ? and(...filters) : filters[0];
    const rows = await getDb().select().from(memoryItems).where(where).orderBy(desc(memoryItems.createdAt), desc(memoryItems.id)).limit(100);
    return withExtensionCors(request, Response.json({ items: rows.map(present) }));
  } catch (error) {
    return withExtensionCors(request, Response.json({ error: error instanceof Error ? error.message : "读取失败" }, { status: 500 }));
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const payload = await request.json() as { title?: string; content?: string; url?: string; sourceUrl?: string; captureType?: string; kind?: string; reason?: string; tags?: string[]; project?: string };
    const content = payload.content?.trim() ?? "";
    const rawUrl = payload.url?.trim() || ((payload.kind === "链接" || looksLikeUrl(content)) ? content : "");
    if (!content && !payload.title?.trim() && !rawUrl) return withExtensionCors(request, Response.json({ error: "记录内容不能为空" }, { status: 400 }));
    const response = rawUrl ? await saveLink(payload, rawUrl) : await saveText(payload, content);
    return withExtensionCors(request, response);
  } catch (error) {
    return withExtensionCors(request, Response.json({ error: error instanceof Error ? error.message : "保存失败" }, { status: 500 }));
  }
}

async function saveLink(payload: { reason?: string; project?: string }, rawUrl: string) {
  const db = getDb();
  const canonicalUrl = canonicalizeUrl(rawUrl);
  const [existing] = await db.select().from(memoryItems).where(eq(memoryItems.canonicalUrl, canonicalUrl)).limit(1);
  if (existing) return Response.json({ error: "已收藏过该链接", duplicate: present(existing) }, { status: 409 });

  const now = new Date().toISOString();
  const host = new URL(canonicalUrl).hostname.replace(/^www\./, "");
  const [placeholder] = await db.insert(memoryItems).values({
    title: host, content: rawUrl, summary: "正在提取网页正文…", source: host, kind: "文章",
    reason: payload.reason?.trim() || "", tags: "[]", project: payload.project?.trim() || null,
    color: "blue", glyph: "网", status: "inbox", processingStatus: "processing",
    originalUrl: rawUrl, canonicalUrl, createdAt: now, updatedAt: now,
  }).returning();

  try {
    const page = await extractWebPage(canonicalUrl);
    const [sameContent] = await db.select().from(memoryItems).where(and(
      ne(memoryItems.id, placeholder.id),
      or(eq(memoryItems.canonicalUrl, page.canonicalUrl), eq(memoryItems.contentHash, page.contentHash)),
    )).limit(1);
    if (sameContent) {
      const [duplicate] = await db.update(memoryItems).set({
        title: page.title, content: page.text, summary: `与「${sameContent.title}」内容重复`, source: page.siteName,
        canonicalUrl: page.canonicalUrl, contentHash: page.contentHash, author: page.author, siteName: page.siteName,
        duplicateOfId: sameContent.id, processingStatus: "duplicate", updatedAt: new Date().toISOString(),
      }).where(eq(memoryItems.id, placeholder.id)).returning();
      return Response.json({ item: present(duplicate) }, { status: 201 });
    }
    const analysis = await analyzeContent(page.title, page.text, page.canonicalUrl);
    const visual = visualFor(analysis.kind);
    const [ready] = await db.update(memoryItems).set({
      title: page.title, content: page.text, summary: analysis.summary, source: page.siteName, kind: analysis.kind,
      tags: JSON.stringify(analysis.tags), color: visual.color, glyph: visual.glyph, canonicalUrl: page.canonicalUrl,
      contentHash: page.contentHash, author: page.author, siteName: page.siteName, processingStatus: "ready",
      processingError: null, aiProvider: analysis.provider, updatedAt: new Date().toISOString(),
    }).where(eq(memoryItems.id, placeholder.id)).returning();
    return Response.json({ item: present(ready) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "网页处理失败";
    const [failed] = await db.update(memoryItems).set({
      summary: "链接已保存，但网页正文暂时无法提取。", processingStatus: "failed", processingError: message,
      updatedAt: new Date().toISOString(),
    }).where(eq(memoryItems.id, placeholder.id)).returning();
    return Response.json({ item: present(failed), warning: message }, { status: 202 });
  }
}

async function saveText(payload: { title?: string; sourceUrl?: string; captureType?: string; kind?: string; reason?: string; tags?: string[]; project?: string }, content: string) {
  const db = getDb();
  const title = payload.title?.trim() || content.split(/\n/)[0]?.slice(0, 36) || "未命名记录";
  const analysis = await analyzeContent(title, content);
  const contentHash = await fingerprintContent(content);
  const [sameContent] = await db.select().from(memoryItems).where(eq(memoryItems.contentHash, contentHash)).limit(1);
  const kind = payload.kind && !["想法", "链接"].includes(payload.kind) ? payload.kind : "笔记";
  const visual = visualFor(kind);
  const sourceUrl = payload.sourceUrl && looksLikeUrl(payload.sourceUrl) ? payload.sourceUrl : null;
  const source = sourceUrl ? new URL(sourceUrl).hostname.replace(/^www\./, "") : "手动记录";
  const now = new Date().toISOString();
  const [row] = await db.insert(memoryItems).values({
    title, content, summary: sameContent ? `与「${sameContent.title}」内容重复` : analysis.summary,
    source, kind, reason: payload.reason?.trim() || (payload.captureType === "selection" ? "浏览器划词摘录" : ""),
    tags: JSON.stringify(payload.tags?.length ? payload.tags : analysis.tags), project: payload.project?.trim() || null,
    color: visual.color, glyph: visual.glyph, status: "inbox", contentHash,
    duplicateOfId: sameContent?.id || null, processingStatus: sameContent ? "duplicate" : "ready",
    originalUrl: sourceUrl, aiProvider: analysis.provider, createdAt: now, updatedAt: now,
  }).returning();
  return Response.json({ item: present(row) }, { status: 201 });
}

export async function PATCH(request: Request) {
  try {
    await ensureSchema();
    const payload = await request.json() as { id?: number; status?: string; reason?: string };
    if (!payload.id) return withExtensionCors(request, Response.json({ error: "id is required" }, { status: 400 }));
    const changes: Partial<typeof memoryItems.$inferInsert> = { updatedAt: new Date().toISOString() };
    if (payload.status) changes.status = payload.status;
    if (payload.reason !== undefined) changes.reason = payload.reason.trim();
    const [row] = await getDb().update(memoryItems).set(changes).where(eq(memoryItems.id, payload.id)).returning();
    if (!row) return withExtensionCors(request, Response.json({ error: "记录不存在" }, { status: 404 }));
    return withExtensionCors(request, Response.json({ item: present(row) }));
  } catch (error) {
    return withExtensionCors(request, Response.json({ error: error instanceof Error ? error.message : "更新失败" }, { status: 500 }));
  }
}
