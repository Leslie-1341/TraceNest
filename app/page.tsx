"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Page = "today" | "inbox" | "tasks" | "library" | "review" | "profile";
type Item = {
  id: number; title: string; content?: string; source: string; kind: string; time: string; summary: string; reason: string;
  tags: string[]; color: string; glyph: string; project?: string; status?: string; processingStatus?: string;
  originalUrl?: string; canonicalUrl?: string; author?: string; siteName?: string; duplicateOfId?: number;
  processingError?: string; aiProvider?: "openai" | "rules";
};
type Task = {
  id: number; title: string; notes: string; dueDate?: string | null; dueTime?: string | null;
  priority: "low" | "normal" | "high"; completed: boolean; calendarProvider: string; createdAt: string; updatedAt: string;
};

const demoItems: Item[] = [
  { id: 1, title: "异步预取设计", source: "项目笔记", kind: "笔记", time: "2 小时前", summary: "记录了在 OS 大赛中实现异步预取的思路与细节，包括 KV Cache 的分层管理与预取时机策略。", reason: "用于完善 KV Cache 异步预取方案", tags: ["系统优化", "KV Cache", "代码"], color: "sage", glyph: "芯", project: "OS 大赛" },
  { id: 2, title: "低美术成本的游戏机制", source: "B站视频", kind: "视频", time: "昨天", summary: "通过机制驱动体验的八个设计方向，减少美术资源依赖，同时保持原型的视觉辨识度。", reason: "为 Game Jam 寻找轻量玩法参考", tags: ["游戏设计", "灵感"], color: "amber", glyph: "玩", project: "GMTK Game Jam" },
  { id: 3, title: "个人知识库的收集闭环", source: "网页文章", kind: "文章", time: "3 天前", summary: "从收集、处理、关联到回顾，讨论如何建立可持续的个人知识系统。", reason: "拾迹产品架构参考", tags: ["知识管理", "产品"], color: "sage", glyph: "环", project: "拾迹" },
  { id: 4, title: "CopyCat-BCI/research", source: "GitHub 仓库", kind: "代码", time: "4 天前", summary: "脑机接口研究工具仓库，包含数据预处理和实验管线。", reason: "后续调研时查看实现", tags: ["GitHub", "研究"], color: "ink", glyph: "GH" },
];

const nav = [
  ["today", "今日", "home"], ["inbox", "收件箱", "inbox"], ["tasks", "待办", "calendar"],
  ["library", "知识库", "book"], ["review", "回顾", "clock"], ["profile", "我的", "user"],
] as const;

function Icon({ name, size = 21 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    home: <><path d="M4 10.8 12 4l8 6.8V20H4Z"/><path d="M9 20v-6h6v6"/></>,
    inbox: <><path d="M4 5h16l2 14H2Z"/><path d="M2.8 14H8l1.5 2h5L16 14h5.2"/></>,
    book: <><path d="M3 5.5A4.5 4.5 0 0 1 7.5 3H11v17H7.5A4.5 4.5 0 0 0 3 22Z"/><path d="M21 5.5A4.5 4.5 0 0 0 16.5 3H13v17h3.5a4.5 4.5 0 0 1 4.5 2Z"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>, mic: <><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>, arrow: <path d="m9 5 7 7-7 7"/>,
    spark: <><path d="m12 3 1.2 4.3L17 9l-3.8 1.7L12 15l-1.2-4.3L7 9l3.8-1.7Z"/><path d="m5 14 .7 2.3L8 17l-2.3.7L5 20l-.7-2.3L2 17l2.3-.7Z"/></>,
    check: <path d="m5 12 4 4L19 6"/>, tag: <><path d="M20 13 13 20 4 11V4h7Z"/><circle cx="8" cy="8" r="1"/></>,
    share: <><circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="m8 11 8-5M8 13l8 5"/></>,
    edit: <><path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14"/></>,
    download: <><path d="M12 3v12m-4-4 4 4 4-4"/><path d="M4 19h16"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Brand() { return <div className="brand"><span className="nest-mark"><i/><i/><i/></span><span><b>拾迹</b><small>TraceNest</small></span></div>; }

function ItemRow({ item, onOpen }: { item: Item; onOpen: (item: Item) => void }) {
  const label = item.processingStatus === "failed" ? "提取失败" : item.processingStatus === "duplicate" ? "重复内容" : item.aiProvider === "openai" ? "AI 已整理" : item.aiProvider === "rules" ? "规则整理" : "";
  return <button className="item-row" onClick={() => onOpen(item)}>
    <span className={`source-icon ${item.color}`}>{item.glyph}</span>
    <span className="item-main"><b>{item.title}</b><small>{item.source} · {item.summary}</small></span>
    <span className="item-meta"><small>{item.time}</small><span>{label && <i className={`processing-badge ${item.processingStatus || item.aiProvider}`}>{label}</i>}<em>{item.kind}</em></span></span>
    <Icon name="arrow" size={17}/>
  </button>;
}

export default function Home() {
  const [page, setPage] = useState<Page>("today");
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [noteMode, setNoteMode] = useState("想法");
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<Item | null>(null);
  const [composer, setComposer] = useState(false);
  const [filter, setFilter] = useState("全部");
  const [toast, setToast] = useState("");
  const [records, setRecords] = useState<Item[]>(demoItems);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dateLabel, setDateLabel] = useState("今天");

  useEffect(() => {
    let active = true;
    Promise.all([fetch("/api/items").then(r => r.ok ? r.json() : Promise.reject()), fetch("/api/tasks").then(r => r.ok ? r.json() : Promise.reject())])
      .then(([itemData, taskData]: [{ items?: Item[] }, { tasks?: Task[] }]) => {
        if (!active) return;
        setDateLabel(new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" }));
        if (itemData.items) setRecords(itemData.items);
        setTasks(taskData.tasks || []);
      })
      .catch(() => showToast("暂时无法连接数据服务，正在显示本地示例"))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function showToast(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2800); }

  const filtered = useMemo(() => records.filter(item => {
    const text = `${item.title}${item.source}${item.summary}${item.reason}${item.tags.join("")}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (filter === "全部" || item.kind === filter || item.tags.includes(filter));
  }), [query, filter, records]);

  async function saveNote(event?: FormEvent) {
    event?.preventDefault();
    if (!note.trim()) { showToast("先写下一点什么"); return; }
    const content = note.trim();
    const isLink = noteMode === "链接" || /^https?:\/\/\S+$/i.test(content);
    setSaving(true);
    try {
      if (noteMode === "待办" && !isLink) {
        const response = await fetch("/api/tasks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: content, notes: reason }) });
        const data = await response.json() as { task?: Task; error?: string };
        if (!response.ok || !data.task) throw new Error(data.error || "保存失败");
        setTasks(current => [...current, data.task!]);
        showToast("待办已加入任务列表和日历");
      } else {
        const response = await fetch("/api/items", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content, kind: isLink ? "链接" : noteMode, reason }) });
        const data = await response.json() as { item?: Item; duplicate?: Item; error?: string };
        if (response.status === 409 && data.duplicate) { setSelected(data.duplicate); showToast("这条链接已经收藏过，已打开原记录"); return; }
        if (!response.ok || !data.item) throw new Error(data.error || "保存失败");
        setRecords(current => [data.item!, ...current]);
        showToast(data.item.processingStatus === "failed" ? "链接已保存，正文暂时无法提取" : "已保存并完成自动整理");
      }
      setSaved(true); setNote(""); setReason(""); setComposer(false);
      window.setTimeout(() => setSaved(false), 1800);
    } catch (error) { showToast(error instanceof Error ? error.message : "保存失败，请稍后重试"); }
    finally { setSaving(false); }
  }

  function updateRecord(item: Item) {
    setRecords(current => current.map(existing => existing.id === item.id ? item : existing));
    setSelected(item);
  }
  function removeRecord(id: number) {
    setRecords(current => current.filter(item => item.id !== id));
    setSelected(null);
  }

  async function createTask(input: { title: string; notes: string; dueDate: string; dueTime: string; priority: string }) {
    const response = await fetch("/api/tasks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
    const data = await response.json() as { task?: Task; error?: string };
    if (!response.ok || !data.task) throw new Error(data.error || "创建待办失败");
    setTasks(current => [...current, data.task!]);
    showToast("待办已加入日历");
  }
  async function patchTask(id: number, changes: Partial<Task>) {
    const response = await fetch("/api/tasks", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, ...changes }) });
    const data = await response.json() as { task?: Task; error?: string };
    if (!response.ok || !data.task) throw new Error(data.error || "更新待办失败");
    setTasks(current => current.map(task => task.id === id ? data.task! : task));
  }
  async function deleteTask(id: number) {
    const response = await fetch(`/api/tasks?id=${id}`, { method: "DELETE" });
    if (!response.ok) throw new Error("删除待办失败");
    setTasks(current => current.filter(task => task.id !== id));
    showToast("待办已删除");
  }

  const titles: Record<Page, [string, string]> = {
    today: ["早上好，Xinrong", "拾起今天的碎片，也看看过去留下的线索。"], inbox: ["收件箱", "先收进来，整理的事交给拾迹。"],
    tasks: ["待办与日历", "把收藏转化为下一步行动。"], library: ["知识库", "从主题、项目和来源，看见同一批记忆。"],
    review: ["回顾", "让重要内容在需要的时候重新出现。"], profile: ["我的", "管理数据空间、连接来源与整理偏好。"],
  };
  const openTasks = tasks.filter(task => !task.completed);

  return <div className="app-shell">
    <aside className="sidebar"><Brand/><nav>{nav.map(([id, label, icon]) => <button key={id} className={page === id ? "active" : ""} onClick={() => setPage(id)}><Icon name={icon}/><span>{label}</span>{id === "inbox" && <em>{records.length}</em>}{id === "tasks" && openTasks.length > 0 && <em>{openTasks.length}</em>}</button>)}</nav><div className="side-bottom"><div className="sync"><span><i/>同步完成</span><small>2.6 GB / 10 GB</small></div><button className="profile-mini"><span>新</span><b>Xinrong</b><Icon name="arrow" size={16}/></button></div></aside>
    <main className="workspace">
      <header className="topbar"><div><p>{dateLabel || "今天"}</p><h1>{titles[page][0]}</h1><span>{titles[page][1]}</span></div><div className="top-actions"><label className="search"><Icon name="search"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索你的记忆…"/><kbd>⌘ K</kbd></label><button className="add" onClick={() => setComposer(true)} aria-label="新建记录"><Icon name="plus"/></button></div></header>

      {page === "today" && <section className="page-content today-page">
        <QuickCapture note={note} setNote={setNote} noteMode={noteMode} setNoteMode={setNoteMode} saving={saving} saved={saved} onSubmit={saveNote}/>
        <div className="today-task-strip"><span><Icon name="calendar" size={18}/><b>今日待办</b><small>{openTasks.filter(task => task.dueDate === todayKey()).length} 项今天到期 · 共 {openTasks.length} 项未完成</small></span><button onClick={() => setPage("tasks")}>查看待办 <Icon name="arrow" size={15}/></button></div>
        <div className="today-grid"><section><div className="section-title"><div><span className="eyebrow"><Icon name="spark" size={15}/>AI 为你回顾</span><h2>过去的线索，今天可能有用</h2></div><button onClick={() => setPage("review")}>换一组</button></div><div className="review-stack">{records.slice(0, 3).map(item => <button className="review-card" key={item.id} onClick={() => setSelected(item)}><span className={`source-icon large ${item.color}`}>{item.glyph}</span><span><b>{item.title}</b><small>{item.project && <em>● {item.project}</em>}{item.summary}</small><i>{item.time}</i></span><Icon name="arrow" size={17}/></button>)}</div></section><section><div className="section-title"><div><span className="eyebrow">最近收件箱</span><h2>{loading ? "正在读取…" : `${records.length} 条内容`}</h2></div><button onClick={() => setPage("inbox")}>查看全部</button></div><div className="inbox-list">{records.slice(0, 4).map(item => <ItemRow key={item.id} item={item} onOpen={setSelected}/>)}</div></section></div>
      </section>}

      {page === "inbox" && <section className="page-content"><div className="filterbar">{["全部", "文章", "视频", "截图", "笔记", "代码"].map(value => <button className={filter === value ? "active" : ""} onClick={() => setFilter(value)} key={value}>{value}</button>)}<span>{filtered.length} 条内容</span></div><div className="panel inbox-full">{filtered.map(item => <ItemRow key={item.id} item={item} onOpen={setSelected}/>)}{!filtered.length && <Empty/>}</div></section>}
      {page === "tasks" && <TasksPage tasks={tasks} onCreate={createTask} onPatch={patchTask} onDelete={deleteTask} onToast={showToast}/>}
      {page === "library" && <section className="page-content"><div className="library-hero"><div><span className="eyebrow"><Icon name="spark" size={15}/>自动整理</span><h2>你的知识正在形成结构</h2><p>同一条内容可以同时属于主题、项目和来源，不必反复移动。</p></div><div className="stats"><span><b>{records.length}</b>记忆条目</span><span><b>{new Set(records.flatMap(item => item.tags)).size}</b>活跃标签</span><span><b>{records.filter(item => item.project).length}</b>项目关联</span></div></div><div className="topic-grid">{[["系统与推理优化", "#7e8e78"], ["产品与交互设计", "#b86f52"], ["游戏创意", "#c6a267"], ["个人成长", "#7d8da4"]].map(([title, color]) => <button className="topic-card" key={title} style={{ "--topic": color } as React.CSSProperties}><i/><span><b>{title}</b><small>由拾迹动态聚合</small></span><Icon name="arrow" size={18}/></button>)}</div><div className="panel">{filtered.slice(0, 6).map(item => <ItemRow key={item.id} item={item} onOpen={setSelected}/>)}</div></section>}
      {page === "review" && <section className="page-content"><div className="review-hero"><span className="review-orbit"><i/><i/><b>3</b></span><div><span className="eyebrow"><Icon name="spark" size={15}/>今日回顾</span><h2>三条记忆，重新连接今天</h2><p>一条最近收藏、一条长期未读、一条与你当前项目有关。</p></div><button onClick={() => showToast("已生成新一组回顾")}>开始回顾</button></div><div className="review-columns">{records.slice(0, 3).map((item, index) => <article key={item.id}><span>0{index + 1} · {index === 0 ? "最近收藏" : index === 1 ? "长期未读" : "项目相关"}</span><div className={`source-icon large ${item.color}`}>{item.glyph}</div><h3>{item.title}</h3><p>{item.summary}</p><div>{item.tags.map(tag => <em key={tag}>#{tag}</em>)}</div><button onClick={() => setSelected(item)}>查看记忆 <Icon name="arrow" size={16}/></button></article>)}</div></section>}
      {page === "profile" && <ProfilePage/>}
    </main>

    <nav className="mobile-nav">{nav.slice(0, 4).map(([id, label, icon]) => <button key={id} className={page === id ? "active" : ""} onClick={() => setPage(id)}><Icon name={icon}/><span>{label}</span></button>)}<button className="mobile-add" onClick={() => setComposer(true)}><Icon name="plus"/></button></nav>
    {(selected || composer) && <div className="overlay" onMouseDown={() => { setSelected(null); setComposer(false); }}><aside className="drawer" onMouseDown={event => event.stopPropagation()}><button className="drawer-close" onClick={() => { setSelected(null); setComposer(false); }} aria-label="关闭"><Icon name="close"/></button>{selected ? <Detail item={selected} onChanged={updateRecord} onDeleted={removeRecord} onToast={showToast}/> : <form className="composer" onSubmit={saveNote}><span className="eyebrow">快速收集</span><h2>保存一条新记忆</h2><p>粘贴链接后自动提取、摘要、标签和去重；待办会进入任务日历。</p><textarea autoFocus value={note} onChange={event => setNote(event.target.value)} placeholder="粘贴链接、写下想法，或描述待办…"/><div className="composer-modes">{["想法", "待办", "日记", "链接"].map(mode => <button type="button" className={noteMode === mode ? "active" : ""} onClick={() => setNoteMode(mode)} key={mode}>{mode}</button>)}</div><label>{noteMode === "待办" ? "补充说明" : "为什么保存？"}<input value={reason} onChange={event => setReason(event.target.value)} placeholder="可选"/></label><button className="primary" type="submit" disabled={saving}>{saving ? "正在保存…" : noteMode === "待办" ? "创建待办" : "放入收件箱"}</button></form>}</aside></div>}
    {toast && <div className="toast"><Icon name="check" size={17}/>{toast}</div>}
  </div>;
}

function QuickCapture({ note, setNote, noteMode, setNoteMode, saving, saved, onSubmit }: { note: string; setNote: (value: string) => void; noteMode: string; setNoteMode: (value: string) => void; saving: boolean; saved: boolean; onSubmit: (event?: FormEvent) => void }) {
  return <form className="quick-card" onSubmit={onSubmit}><textarea value={note} onChange={event => setNote(event.target.value)} placeholder="记录此刻想到的…" aria-label="快速记录"/><div className="quick-footer"><div className="modes">{["想法", "待办", "日记"].map(mode => <button type="button" className={noteMode === mode ? "active" : ""} onClick={() => setNoteMode(mode)} key={mode}>{mode === "待办" && <Icon name="check" size={15}/>} {mode}</button>)}<button type="button"><Icon name="mic" size={16}/> 语音</button></div><button className="save-note" type="submit" disabled={saving}>{saving ? "正在保存…" : saved ? "已保存" : "保存"} <span>⌘ Enter</span></button></div></form>;
}

function Detail({ item, onChanged, onDeleted, onToast }: { item: Item; onChanged: (item: Item) => void; onDeleted: (id: number) => void; onToast: (message: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [summary, setSummary] = useState(item.summary);
  const [reason, setReason] = useState(item.reason);
  const [tags, setTags] = useState(item.tags.join("，"));
  const [project, setProject] = useState(item.project || "");

  async function saveChanges(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      const response = await fetch("/api/items", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: item.id, title, summary, reason, project, tags: tags.split(/[，,]/).map(tag => tag.trim()).filter(Boolean) }) });
      const data = await response.json() as { item?: Item; error?: string };
      if (!response.ok || !data.item) throw new Error(data.error || "修改失败");
      onChanged(data.item); setEditing(false); onToast("记录修改已保存");
    } catch (error) { onToast(error instanceof Error ? error.message : "修改失败"); }
    finally { setBusy(false); }
  }
  async function deleteItem() {
    setBusy(true);
    try {
      const response = await fetch(`/api/items?id=${item.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("删除失败");
      onDeleted(item.id); onToast("记录已删除");
    } catch (error) { onToast(error instanceof Error ? error.message : "删除失败"); setBusy(false); }
  }

  if (editing) return <form className="detail edit-form" onSubmit={saveChanges}><span className="eyebrow"><Icon name="edit" size={15}/>编辑记录</span><h2>修改内容</h2><label>标题<input value={title} onChange={event => setTitle(event.target.value)} maxLength={180}/></label><label>摘要<textarea value={summary} onChange={event => setSummary(event.target.value)} maxLength={500}/></label><label>为什么收藏<input value={reason} onChange={event => setReason(event.target.value)}/></label><label>标签<input value={tags} onChange={event => setTags(event.target.value)} placeholder="用逗号分隔"/></label><label>关联项目<input value={project} onChange={event => setProject(event.target.value)}/></label><div className="detail-actions"><button type="button" onClick={() => setEditing(false)}>取消</button><button className="primary" type="submit" disabled={busy}>{busy ? "保存中…" : "保存修改"}</button></div></form>;

  const statusText = item.processingStatus === "failed" ? `正文提取失败：${item.processingError || "网页可能需要登录"}` : item.processingStatus === "duplicate" ? "系统发现这条内容与已有记录高度重复。" : item.aiProvider === "openai" ? "已完成正文提取、AI 摘要与自动标签。" : item.aiProvider === "rules" ? "已完成正文提取和规则整理。" : "原始内容已安全保存。";
  return <div className="detail"><span className={`source-icon detail-icon ${item.color}`}>{item.glyph}</span><span className="eyebrow">{item.source} · {item.time}</span><h2>{item.title}</h2><p className="detail-summary">{item.summary}</p><div className={`pipeline-status ${item.processingStatus || "ready"}`}><b>{item.processingStatus === "failed" ? "需要重试" : item.processingStatus === "duplicate" ? "重复内容" : "处理完成"}</b><span>{statusText}</span></div>{(item.siteName || item.author) && <section><h3>来源信息</h3><p>{[item.siteName, item.author].filter(Boolean).join(" · ")}</p></section>}<section><h3>为什么收藏</h3><p>{item.reason || "尚未补充"}</p></section><section><h3>自动标签</h3><div className="tags">{item.tags.length ? item.tags.map(tag => <em key={tag}><Icon name="tag" size={13}/>{tag}</em>) : <span>暂无标签</span>}</div></section>{item.project && <section><h3>关联项目</h3><button className="project-link">{item.project}<Icon name="arrow" size={16}/></button></section>}{confirmDelete && <div className="delete-confirm"><b>确定删除这条记录？</b><span>删除后无法恢复，原始链接和自动整理结果会一并移除。</span><div><button onClick={() => setConfirmDelete(false)}>取消</button><button className="danger" onClick={deleteItem} disabled={busy}>{busy ? "删除中…" : "确认删除"}</button></div></div>}<div className="detail-actions"><button onClick={() => setEditing(true)}><Icon name="edit" size={14}/>编辑</button><button className="danger-outline" onClick={() => setConfirmDelete(true)}><Icon name="trash" size={14}/>删除</button>{item.originalUrl && <a className="primary" href={item.originalUrl} target="_blank" rel="noreferrer">打开原内容</a>}</div></div>;
}

function TasksPage({ tasks, onCreate, onPatch, onDelete, onToast }: { tasks: Task[]; onCreate: (input: { title: string; notes: string; dueDate: string; dueTime: string; priority: string }) => Promise<void>; onPatch: (id: number, changes: Partial<Task>) => Promise<void>; onDelete: (id: number) => Promise<void>; onToast: (message: string) => void }) {
  const [title, setTitle] = useState(""); const [notes, setNotes] = useState(""); const [dueDate, setDueDate] = useState(todayKey()); const [dueTime, setDueTime] = useState(""); const [priority, setPriority] = useState("normal"); const [busy, setBusy] = useState(false); const [monthOffset, setMonthOffset] = useState(0);
  const anchor = new Date(); anchor.setDate(1); anchor.setMonth(anchor.getMonth() + monthOffset);
  const days = buildCalendarDays(anchor);

  async function submit(event: FormEvent) { event.preventDefault(); if (!title.trim()) { onToast("请输入待办内容"); return; } setBusy(true); try { await onCreate({ title: title.trim(), notes, dueDate, dueTime, priority }); setTitle(""); setNotes(""); } catch (error) { onToast(error instanceof Error ? error.message : "创建失败"); } finally { setBusy(false); } }
  function exportCalendar() {
    const active = tasks.filter(task => !task.completed && task.dueDate);
    if (!active.length) { onToast("暂无带日期的未完成待办"); return; }
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TraceNest//Tasks//ZH"];
    for (const task of active) {
      const date = task.dueDate!.replace(/-/g, ""); const time = task.dueTime?.replace(":", "") || "";
      lines.push("BEGIN:VEVENT", `UID:tracenest-task-${task.id}@tracenest`, time ? `DTSTART:${date}T${time}00` : `DTSTART;VALUE=DATE:${date}`, `SUMMARY:${escapeIcs(task.title)}`, task.notes ? `DESCRIPTION:${escapeIcs(task.notes)}` : "", "END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    const url = URL.createObjectURL(new Blob([lines.filter(Boolean).join("\r\n")], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "TraceNest-待办日历.ics"; link.click(); URL.revokeObjectURL(url); onToast("日历文件已导出");
  }

  return <section className="page-content tasks-page"><form className="task-create-card" onSubmit={submit}><div><span className="eyebrow"><Icon name="plus" size={14}/>新建待办</span><input className="task-title-input" value={title} onChange={event => setTitle(event.target.value)} placeholder="接下来要完成什么？"/></div><div className="task-fields"><label>日期<input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)}/></label><label>时间<input type="time" value={dueTime} onChange={event => setDueTime(event.target.value)}/></label><label>优先级<select value={priority} onChange={event => setPriority(event.target.value)}><option value="low">低</option><option value="normal">普通</option><option value="high">高</option></select></label><label className="task-notes">备注<input value={notes} onChange={event => setNotes(event.target.value)} placeholder="可选"/></label><button className="primary" disabled={busy}>{busy ? "创建中…" : "添加待办"}</button></div></form><div className="task-layout"><section className="panel task-list-panel"><div className="task-panel-title"><div><span className="eyebrow">行动清单</span><h2>{tasks.filter(task => !task.completed).length} 项未完成</h2></div><button onClick={exportCalendar}><Icon name="download" size={15}/>导出日历</button></div><div className="task-list">{tasks.map(task => <article className={task.completed ? "completed" : ""} key={task.id}><button className="task-check" onClick={() => onPatch(task.id, { completed: !task.completed }).catch(error => onToast(error.message))} aria-label={task.completed ? "标记未完成" : "标记完成"}>{task.completed && <Icon name="check" size={14}/>}</button><span><b>{task.title}</b><small>{task.dueDate ? `${task.dueDate}${task.dueTime ? ` ${task.dueTime}` : ""}` : "未设置日期"}{task.notes && ` · ${task.notes}`}</small></span><em className={`priority ${task.priority}`}>{task.priority === "high" ? "高" : task.priority === "low" ? "低" : "普通"}</em><button className="task-delete" onClick={() => onDelete(task.id).catch(error => onToast(error.message))} aria-label="删除待办"><Icon name="trash" size={15}/></button></article>)}{!tasks.length && <div className="task-empty">还没有待办，从上方创建第一项。</div>}</div></section><section className="panel calendar-panel"><div className="calendar-head"><button onClick={() => setMonthOffset(value => value - 1)} aria-label="上个月">‹</button><div><span className="eyebrow">内部日历</span><h2>{anchor.getFullYear()}年{anchor.getMonth() + 1}月</h2></div><button onClick={() => setMonthOffset(value => value + 1)} aria-label="下个月">›</button></div><div className="calendar-week">{["一", "二", "三", "四", "五", "六", "日"].map(day => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{days.map(day => { const key = dateKey(day); const dayTasks = tasks.filter(task => task.dueDate === key && !task.completed); return <div className={`${day.getMonth() !== anchor.getMonth() ? "muted" : ""} ${key === todayKey() ? "today" : ""}`} key={key}><b>{day.getDate()}</b>{dayTasks.slice(0, 2).map(task => <span className={task.priority} key={task.id}>{task.title}</span>)}{dayTasks.length > 2 && <small>+{dayTasks.length - 2}</small>}</div>; })}</div><p>当前为拾迹内部日历；可导出 `.ics` 后导入 Apple、Google 或 Outlook 日历。</p></section></div></section>;
}

function ProfilePage() { return <section className="page-content"><div className="settings-grid"><section className="panel settings"><h2>数据来源</h2><p>先用稳定、透明的方式收集信息。</p><button><Icon name="share"/><span><b>系统分享入口</b><small>手机 App 接入后可用</small></span><em>规划中</em></button><a href="/downloads/TraceNest-Extension-v0.2.0.zip" download><Icon name="book"/><span><b>浏览器扩展 0.2</b><small>修复视频标题与重复识别</small></span><em className="on">下载</em></a><button><Icon name="calendar"/><span><b>系统日历双向同步</b><small>当前支持内部日历与 ICS 导出</small></span><em>下一阶段</em></button></section><section className="panel settings"><h2>数据空间</h2><p>不同内容使用不同处理方式。</p>{[["普通空间", "云同步与 AI 整理", "已启用"], ["私密空间", "仅保存在本地", "未启用"], ["临时空间", "30 天后自动删除", "未启用"]].map(([title, copy, status]) => <button key={title}><span><b>{title}</b><small>{copy}</small></span><em className={status === "已启用" ? "on" : ""}>{status}</em></button>)}</section></div><div className="privacy-note"><b>你的原始内容始终可追溯</b><p>记录现在支持修改和删除；删除前会二次确认。AI 不会未经确认修改或删除原始内容。</p><button>查看隐私说明</button></div></section>; }

function Empty() { return <div className="empty"><Icon name="search" size={32}/><b>没有找到相关内容</b><p>换一个关键词，或清除筛选条件。</p></div>; }
function todayKey() { return dateKey(new Date()); }
function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function buildCalendarDays(anchor: Date) { const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1); const mondayOffset = (first.getDay() + 6) % 7; const start = new Date(first); start.setDate(first.getDate() - mondayOffset); return Array.from({ length: 42 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return date; }); }
function escapeIcs(value: string) { return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;"); }
