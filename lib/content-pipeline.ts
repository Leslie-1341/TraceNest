import { getRuntimeEnv } from "../db/runtime";

export type ContentAnalysis = {
  summary: string;
  tags: string[];
  kind: "文章" | "视频" | "代码" | "笔记" | "资料";
  keyPoints: string[];
  provider: "openai" | "rules";
};

export type ExtractedPage = {
  title: string;
  text: string;
  author: string | null;
  siteName: string;
  canonicalUrl: string;
  contentHash: string;
};

const TRACKING_PARAMS = /^(utm_.+|fbclid|gclid|dclid|msclkid|spm|from|source|ref)$/i;
const MAX_HTML_CHARS = 2_000_000;
const MAX_ARTICLE_CHARS = 45_000;

export function canonicalizeUrl(input: string) {
  const url = new URL(input.trim());
  assertSafeUrl(url);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) url.port = "";
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

export function looksLikeUrl(value: string) {
  try { return /^https?:\/\//i.test(value.trim()) && Boolean(new URL(value.trim()).hostname); }
  catch { return false; }
}

export async function extractWebPage(input: string): Promise<ExtractedPage> {
  let current = new URL(canonicalizeUrl(input));
  let response: Response | null = null;
  for (let redirect = 0; redirect < 4; redirect += 1) {
    assertSafeUrl(current);
    response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(12_000),
      headers: {
        accept: "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8",
        "user-agent": "TraceNest/1.0 (+personal knowledge capture)",
      },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("网页重定向缺少目标地址");
      current = new URL(location, current);
      continue;
    }
    break;
  }
  if (!response?.ok) throw new Error(`网页读取失败（${response?.status ?? "network"}）`);
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("text/plain") && !contentType.includes("application/xhtml")) {
    throw new Error("当前链接不是可提取的网页正文");
  }
  const html = (await response.text()).slice(0, MAX_HTML_CHARS);
  const finalUrl = canonicalizeUrl(response.url || current.toString());
  const title = firstMeta(html, ["og:title", "twitter:title"]) || firstTag(html, "title") || new URL(finalUrl).hostname;
  const author = firstMeta(html, ["author", "article:author"]);
  const siteName = firstMeta(html, ["og:site_name"]) || new URL(finalUrl).hostname.replace(/^www\./, "");
  const text = extractReadableText(html);
  if (text.length < 40) throw new Error("网页正文过短或需要登录后访问");
  return { title: cleanText(title).slice(0, 180), text, author: author ? cleanText(author).slice(0, 100) : null, siteName, canonicalUrl: finalUrl, contentHash: await sha256(text) };
}

export async function analyzeContent(title: string, text: string, url?: string): Promise<ContentAnalysis> {
  const env = getRuntimeEnv();
  if (env.OPENAI_API_KEY) {
    try { return await analyzeWithOpenAI(title, text, url, env); }
    catch { /* The rule-based result remains usable and traceable. */ }
  }
  return analyzeWithRules(title, text, url);
}

export function fingerprintContent(value: string) {
  return sha256(cleanText(value));
}

async function analyzeWithOpenAI(title: string, text: string, url: string | undefined, env: ReturnType<typeof getRuntimeEnv>): Promise<ContentAnalysis> {
  const base = (env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  if (!base.startsWith("https://")) throw new Error("OPENAI_BASE_URL 必须使用 HTTPS");
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string", minLength: 20, maxLength: 260 },
      tags: { type: "array", minItems: 2, maxItems: 5, items: { type: "string", minLength: 1, maxLength: 16 } },
      kind: { type: "string", enum: ["文章", "视频", "代码", "笔记", "资料"] },
      keyPoints: { type: "array", minItems: 1, maxItems: 4, items: { type: "string", minLength: 4, maxLength: 80 } },
    },
    required: ["summary", "tags", "kind", "keyPoints"],
  };
  const response = await fetch(`${base}/responses`, {
    method: "POST",
    signal: AbortSignal.timeout(20_000),
    headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-5.6",
      store: false,
      max_output_tokens: 700,
      input: [
        { role: "developer", content: [{ type: "input_text", text: "你是个人知识库的信息整理器。基于原文生成准确、具体的中文摘要和少量标签；不得补充原文没有的信息。" }] },
        { role: "user", content: [{ type: "input_text", text: `标题：${title}\n链接：${url || "无"}\n正文：\n${text.slice(0, 24_000)}` }] },
      ],
      text: { format: { type: "json_schema", name: "memory_analysis", strict: true, schema } },
    }),
  });
  if (!response.ok) throw new Error(`AI 整理失败（${response.status}）`);
  const payload = await response.json() as { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> };
  const outputText = payload.output?.flatMap(item => item.content || []).find(item => item.type === "output_text")?.text;
  if (!outputText) throw new Error("AI 未返回结构化结果");
  const parsed = JSON.parse(outputText) as Omit<ContentAnalysis, "provider">;
  return { ...parsed, tags: uniqueTags(parsed.tags), provider: "openai" };
}

function analyzeWithRules(title: string, text: string, url?: string): ContentAnalysis {
  const joined = `${title}\n${text}`;
  const candidates: Array<[RegExp, string]> = [
    [/大模型|LLM|推理|模型/i, "大模型"], [/操作系统|内存|缓存|cache/i, "系统优化"], [/游戏|Game Jam/i, "游戏设计"],
    [/产品|交互|用户体验|UI/i, "产品设计"], [/知识库|笔记|收藏/i, "知识管理"], [/GitHub|代码|repository|开发/i, "开发"],
    [/论文|研究|实验/i, "研究"], [/AI|人工智能/i, "AI"], [/效率|工作流/i, "效率"],
  ];
  const tags = candidates.filter(([pattern]) => pattern.test(joined)).map(([, tag]) => tag);
  const host = url ? new URL(url).hostname.replace(/^www\./, "") : "";
  if (host && tags.length < 2) tags.push(host.split(".")[0]);
  if (tags.length < 2) tags.push("网页收藏", "待整理");
  const sentences = cleanText(text).split(/(?<=[。！？.!?])\s*/).filter(Boolean);
  const summary = sentences.slice(0, 3).join("").slice(0, 220) || title;
  const kind = /github\.com/i.test(url || "") ? "代码" : /(youtube|bilibili|douyin|youtu\.be)/i.test(url || "") ? "视频" : "文章";
  return { summary, tags: uniqueTags(tags).slice(0, 5), kind, keyPoints: sentences.slice(0, 3).map(item => item.slice(0, 80)), provider: "rules" };
}

function assertSafeUrl(url: URL) {
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("仅支持 HTTP 或 HTTPS 链接");
  if (url.username || url.password) throw new Error("链接不能包含账号信息");
  if (url.port && !['80', '443'].includes(url.port)) throw new Error("链接端口不受支持");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host === "::1" || host.startsWith("fc") || host.startsWith("fd") || /^fe[89ab]/.test(host)) throw new Error("不允许访问本地网络地址");
  const ipv4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)?.slice(1).map(Number);
  if (ipv4 && (ipv4[0] === 10 || ipv4[0] === 127 || (ipv4[0] === 169 && ipv4[1] === 254) || (ipv4[0] === 172 && ipv4[1] >= 16 && ipv4[1] <= 31) || (ipv4[0] === 192 && ipv4[1] === 168))) throw new Error("不允许访问本地网络地址");
}

function extractReadableText(html: string) {
  const scope = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] || html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
  return cleanText(scope
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/<(script|style|noscript|svg|nav|header|footer|aside|form)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|section|article|li|h[1-6]|blockquote|pre)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")).slice(0, MAX_ARTICLE_CHARS);
}

function firstMeta(html: string, names: string[]) {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, "i"),
    ];
    for (const pattern of patterns) { const match = html.match(pattern); if (match?.[1]) return decodeEntities(match[1]); }
  }
  return null;
}

function firstTag(html: string, tag: string) { return decodeEntities(html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] || ""); }
function cleanText(value: string) { return decodeEntities(value).replace(/\r/g, "").replace(/[\t ]+/g, " ").replace(/\n\s*\n+/g, "\n").trim(); }
function decodeEntities(value: string) { return value.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code))); }
function uniqueTags(tags: string[]) { return [...new Set(tags.map(tag => tag.trim()).filter(Boolean))]; }
async function sha256(value: string) { const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join(""); }
