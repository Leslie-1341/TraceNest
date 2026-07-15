"use client";

import { FormEvent, useMemo, useState } from "react";

type Page = "today" | "inbox" | "library" | "review" | "profile";
type Item = {
  id: number;
  title: string;
  source: string;
  kind: string;
  time: string;
  summary: string;
  reason: string;
  tags: string[];
  color: string;
  glyph: string;
  project?: string;
};

const items: Item[] = [
  { id: 1, title: "异步预取设计", source: "项目笔记", kind: "笔记", time: "2 小时前", summary: "记录了在 OS 大赛中实现异步预取的思路与细节，包括 KV Cache 的分层管理与预取时机策略。", reason: "用于完善 KV Cache 异步预取方案", tags: ["系统优化", "KV Cache", "代码"], color: "sage", glyph: "芯", project: "OS 大赛" },
  { id: 2, title: "低美术成本的游戏机制", source: "B站视频", kind: "视频", time: "昨天", summary: "通过机制驱动体验的八个设计方向，减少美术资源依赖，同时保持原型的视觉辨识度。", reason: "为 Game Jam 寻找轻量玩法参考", tags: ["游戏设计", "灵感"], color: "amber", glyph: "玩", project: "GMTK Game Jam" },
  { id: 3, title: "个人知识库的收集闭环", source: "网页文章", kind: "文章", time: "3 天前", summary: "从收集、处理、关联到回顾，讨论如何建立可持续的个人知识系统。", reason: "拾迹产品架构参考", tags: ["知识管理", "产品"], color: "sage", glyph: "环", project: "拾迹" },
  { id: 4, title: "CopyCat-BCI/research", source: "GitHub 仓库", kind: "代码", time: "4 天前", summary: "脑机接口研究工具仓库，包含数据预处理和实验管线。", reason: "后续调研时查看实现", tags: ["GitHub", "研究"], color: "ink", glyph: "GH" },
  { id: 5, title: "操作系统内存管理简明教程", source: "B站视频", kind: "视频", time: "上周", summary: "以可视化方式讲解分页、缺页和内存换出的核心概念。", reason: "补齐分页管理基础", tags: ["操作系统", "学习"], color: "coral", glyph: "B" },
  { id: 6, title: "LLM 推理优化：连续批处理实践", source: "网页文章", kind: "文章", time: "2 周前", summary: "连续批处理的调度方式、吞吐收益和首 token 延迟之间的权衡。", reason: "作为性能实验的设计依据", tags: ["LLM", "推理优化"], color: "blue", glyph: "网", project: "OS 大赛" },
  { id: 7, title: "截图 OCR 识别", source: "本地截图", kind: "截图", time: "3 周前", summary: "关于端侧 OCR 与增量截图识别的产品讨论截图。", reason: "用于拾迹截图收件箱设计", tags: ["OCR", "资料"], color: "ink", glyph: "图", project: "拾迹" },
];

const nav = [
  ["today", "今日", "home"], ["inbox", "收件箱", "inbox"], ["library", "知识库", "book"], ["review", "回顾", "clock"], ["profile", "我的", "user"],
] as const;

function Icon({ name, size = 21 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    home: <><path d="M4 10.8 12 4l8 6.8V20H4Z"/><path d="M9 20v-6h6v6"/></>,
    inbox: <><path d="M4 5h16l2 14H2Z"/><path d="M2.8 14H8l1.5 2h5L16 14h5.2"/></>,
    book: <><path d="M3 5.5A4.5 4.5 0 0 1 7.5 3H11v17H7.5A4.5 4.5 0 0 0 3 22Z"/><path d="M21 5.5A4.5 4.5 0 0 0 16.5 3H13v17h3.5a4.5 4.5 0 0 1 4.5 2Z"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    mic: <><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    arrow: <path d="m9 5 7 7-7 7"/>,
    spark: <><path d="m12 3 1.2 4.3L17 9l-3.8 1.7L12 15l-1.2-4.3L7 9l3.8-1.7Z"/><path d="m5 14 .7 2.3L8 17l-2.3.7L5 20l-.7-2.3L2 17l2.3-.7Z"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    tag: <><path d="M20 13 13 20 4 11V4h7Z"/><circle cx="8" cy="8" r="1"/></>,
    share: <><circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="m8 11 8-5M8 13l8 5"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Brand() {
  return <div className="brand"><span className="nest-mark"><i/><i/><i/></span><span><b>拾迹</b><small>TraceNest</small></span></div>;
}

function ItemRow({ item, onOpen }: { item: Item; onOpen: (i: Item) => void }) {
  return <button className="item-row" onClick={() => onOpen(item)}>
    <span className={`source-icon ${item.color}`}>{item.glyph}</span>
    <span className="item-main"><b>{item.title}</b><small>{item.source} · {item.summary}</small></span>
    <span className="item-meta"><small>{item.time}</small><em>{item.kind}</em></span>
    <Icon name="arrow" size={17}/>
  </button>;
}

export default function Home() {
  const [page, setPage] = useState<Page>("today");
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [noteMode, setNoteMode] = useState("想法");
  const [saved, setSaved] = useState(false);
  const [selected, setSelected] = useState<Item | null>(null);
  const [composer, setComposer] = useState(false);
  const [filter, setFilter] = useState("全部");
  const [toast, setToast] = useState("");

  const filtered = useMemo(() => items.filter(i => {
    const text = `${i.title}${i.source}${i.summary}${i.reason}${i.tags.join("")}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (filter === "全部" || i.kind === filter || i.tags.includes(filter));
  }), [query, filter]);

  function saveNote(e?: FormEvent) {
    e?.preventDefault();
    if (!note.trim()) { setToast("先写下一点什么"); return; }
    setSaved(true); setToast(`${noteMode}已放入收件箱`); setNote(""); setComposer(false);
    setTimeout(() => setSaved(false), 1800); setTimeout(() => setToast(""), 2400);
  }

  const titles: Record<Page, [string, string]> = {
    today: ["早上好，Xinrong", "拾起今天的碎片，也看看过去留下的线索。"],
    inbox: ["收件箱", "先收进来，整理的事交给拾迹。"],
    library: ["知识库", "从主题、项目和来源，看见同一批记忆。"],
    review: ["回顾", "让重要内容在需要的时候重新出现。"],
    profile: ["我的", "管理数据空间、连接来源与整理偏好。"],
  };

  return <div className="app-shell">
    <aside className="sidebar">
      <Brand/>
      <nav>{nav.map(([id, label, icon]) => <button key={id} className={page === id ? "active" : ""} onClick={() => setPage(id)}><Icon name={icon}/><span>{label}</span>{id === "inbox" && <em>7</em>}</button>)}</nav>
      <div className="side-bottom"><div className="sync"><span><i/>同步完成</span><small>2.6 GB / 10 GB</small></div><button className="profile-mini"><span>新</span><b>Xinrong</b><Icon name="arrow" size={16}/></button></div>
    </aside>

    <main className="workspace">
      <header className="topbar">
        <div><p>7月16日 · 星期四</p><h1>{titles[page][0]}</h1><span>{titles[page][1]}</span></div>
        <div className="top-actions"><label className="search"><Icon name="search"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索你的记忆…"/><kbd>⌘ K</kbd></label><button className="add" onClick={() => setComposer(true)} aria-label="新建记录"><Icon name="plus"/></button></div>
      </header>

      {page === "today" && <section className="page-content today-page">
        <form className="quick-card" onSubmit={saveNote}>
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="记录此刻想到的…" aria-label="快速记录"/>
          <div className="quick-footer"><div className="modes">{["想法", "待办", "日记"].map(m => <button type="button" className={noteMode === m ? "active" : ""} onClick={() => setNoteMode(m)} key={m}>{m === "待办" && <Icon name="check" size={15}/>} {m}</button>)}<button type="button"><Icon name="mic" size={16}/> 语音</button></div><button className="save-note" type="submit">{saved ? "已保存" : "保存"} <span>⌘ Enter</span></button></div>
        </form>
        <div className="today-grid">
          <section><div className="section-title"><div><span className="eyebrow"><Icon name="spark" size={15}/>AI 为你回顾</span><h2>过去的线索，今天可能有用</h2></div><button onClick={() => setPage("review")}>换一组</button></div>
            <div className="review-stack">{items.slice(0,3).map(item => <button className="review-card" key={item.id} onClick={() => setSelected(item)}><span className={`source-icon large ${item.color}`}>{item.glyph}</span><span><b>{item.title}</b><small>{item.project && <em>● {item.project}</em>}{item.summary}</small><i>{item.time}</i></span><Icon name="arrow" size={17}/></button>)}</div>
          </section>
          <section><div className="section-title"><div><span className="eyebrow">最近收件箱</span><h2>等待理解的 7 条内容</h2></div><button onClick={() => setPage("inbox")}>查看全部</button></div><div className="inbox-list">{items.slice(3,7).map(i => <ItemRow key={i.id} item={i} onOpen={setSelected}/>)}</div></section>
        </div>
      </section>}

      {page === "inbox" && <section className="page-content"><div className="filterbar">{["全部","文章","视频","截图","笔记","代码"].map(f => <button className={filter === f ? "active" : ""} onClick={() => setFilter(f)} key={f}>{f}</button>)}<span>{filtered.length} 条内容</span></div><div className="panel inbox-full">{filtered.map(i => <ItemRow key={i.id} item={i} onOpen={setSelected}/>)}{!filtered.length && <Empty/>}</div></section>}

      {page === "library" && <section className="page-content"><div className="library-hero"><div><span className="eyebrow"><Icon name="spark" size={15}/>自动整理完成</span><h2>你的知识正在形成结构</h2><p>拾迹已从 128 条内容中识别出 16 个主题、5 个项目与 34 条关联。</p></div><div className="stats"><span><b>128</b>记忆条目</span><span><b>16</b>活跃主题</span><span><b>34</b>内容关联</span></div></div><div className="topic-grid">{[["系统与推理优化","24 条","#7e8e78"],["产品与交互设计","19 条","#b86f52"],["游戏创意","14 条","#c6a267"],["个人成长","11 条","#7d8da4"]].map(([t,n,c]) => <button className="topic-card" key={t} style={{"--topic":c} as React.CSSProperties}><i/><span><b>{t}</b><small>{n} · 最近更新于昨天</small></span><Icon name="arrow" size={18}/></button>)}</div><div className="section-title library-title"><div><span className="eyebrow">最近使用</span><h2>与你当前项目相关</h2></div></div><div className="panel">{filtered.slice(0,5).map(i => <ItemRow key={i.id} item={i} onOpen={setSelected}/>)}</div></section>}

      {page === "review" && <section className="page-content"><div className="review-hero"><span className="review-orbit"><i/><i/><b>3</b></span><div><span className="eyebrow"><Icon name="spark" size={15}/>今日回顾</span><h2>三条记忆，重新连接今天</h2><p>一条最近收藏、一条长期未读、一条与你当前项目有关。</p></div><button onClick={() => setToast("已生成新一组回顾")}>开始回顾</button></div><div className="review-columns">{items.slice(0,3).map((i,index) => <article key={i.id}><span>0{index+1} · {index === 0 ? "最近收藏" : index === 1 ? "长期未读" : "项目相关"}</span><div className={`source-icon large ${i.color}`}>{i.glyph}</div><h3>{i.title}</h3><p>{i.summary}</p><div>{i.tags.map(t => <em key={t}>#{t}</em>)}</div><button onClick={() => setSelected(i)}>查看记忆 <Icon name="arrow" size={16}/></button></article>)}</div></section>}

      {page === "profile" && <section className="page-content"><div className="settings-grid"><section className="panel settings"><h2>数据来源</h2><p>先用稳定、透明的方式收集信息。</p>{[["系统分享入口","手机 App 接入后可用","share"],["浏览器扩展","首版后续接入","book"],["相册截图","等待 App 授权","inbox"]].map(([a,b,c]) => <button key={a}><Icon name={c}/><span><b>{a}</b><small>{b}</small></span><em>规划中</em></button>)}</section><section className="panel settings"><h2>数据空间</h2><p>不同内容使用不同处理方式。</p>{[["普通空间","云同步与 AI 整理","已启用"],["私密空间","仅保存在本地","未启用"],["临时空间","30 天后自动删除","未启用"]].map(([a,b,c]) => <button key={a}><span><b>{a}</b><small>{b}</small></span><em className={c === "已启用" ? "on" : ""}>{c}</em></button>)}</section></div><div className="privacy-note"><b>你的原始内容始终可追溯</b><p>AI 只提出摘要、标签和关联建议，不会自动删除或改写原始内容。你可以随时导出全部数据。</p><button>查看隐私说明</button></div></section>}
    </main>

    <nav className="mobile-nav">{nav.slice(0,4).map(([id,label,icon]) => <button key={id} className={page === id ? "active" : ""} onClick={() => setPage(id)}><Icon name={icon}/><span>{label}</span></button>)}<button className="mobile-add" onClick={() => setComposer(true)}><Icon name="plus"/></button></nav>

    {(selected || composer) && <div className="overlay" onMouseDown={() => {setSelected(null);setComposer(false)}}><aside className="drawer" onMouseDown={e => e.stopPropagation()}><button className="drawer-close" onClick={() => {setSelected(null);setComposer(false)}}><Icon name="close"/></button>{selected ? <Detail item={selected}/> : <form className="composer" onSubmit={saveNote}><span className="eyebrow">快速收集</span><h2>保存一条新记忆</h2><p>不用先分类，拾迹会在后台理解和整理。</p><textarea autoFocus value={note} onChange={e => setNote(e.target.value)} placeholder="粘贴链接、写下想法，或描述待办…"/><div className="composer-modes">{["想法","待办","日记","链接"].map(m => <button type="button" className={noteMode === m ? "active" : ""} onClick={() => setNoteMode(m)} key={m}>{m}</button>)}</div><label>为什么保存？<input placeholder="可选，例如：用于拾迹交互设计"/></label><button className="primary" type="submit">放入收件箱</button></form>}</aside></div>}
    {toast && <div className="toast"><Icon name="check" size={17}/>{toast}</div>}
  </div>;
}

function Detail({ item }: { item: Item }) {
  return <div className="detail"><span className={`source-icon detail-icon ${item.color}`}>{item.glyph}</span><span className="eyebrow">{item.source} · {item.time}</span><h2>{item.title}</h2><p className="detail-summary">{item.summary}</p><div className="ai-box"><span><Icon name="spark" size={16}/>AI 理解</span><p>这条内容主要与 <b>{item.tags[0]}</b> 有关，适合在{item.project ? `「${item.project}」项目` : "后续研究"}中重新使用。</p></div><section><h3>为什么收藏</h3><p>{item.reason}</p></section><section><h3>自动标签</h3><div className="tags">{item.tags.map(t => <em key={t}><Icon name="tag" size={13}/>{t}</em>)}</div></section>{item.project && <section><h3>关联项目</h3><button className="project-link">{item.project}<Icon name="arrow" size={16}/></button></section>}<div className="detail-actions"><button>标记已使用</button><button className="primary">打开原内容</button></div></div>;
}

function Empty() { return <div className="empty"><Icon name="search" size={32}/><b>没有找到相关内容</b><p>换一个关键词，或清除筛选条件。</p></div>; }
