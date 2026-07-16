/* global chrome */
const API_URL = "https://tracenest-memory.luoxinrong2026.chatgpt.site/api/items";
const SITE_URL = "https://tracenest-memory.luoxinrong2026.chatgpt.site";

let currentTab = null;
let selection = "";
let mode = "page";

const elements = {
  siteName: document.querySelector("#site-name"),
  pageTitle: document.querySelector("#page-title"),
  pageUrl: document.querySelector("#page-url"),
  modePage: document.querySelector("#mode-page"),
  modeSelection: document.querySelector("#mode-selection"),
  selectionCard: document.querySelector("#selection-card"),
  selectionPreview: document.querySelector("#selection-preview"),
  reason: document.querySelector("#reason"),
  save: document.querySelector("#save"),
  status: document.querySelector("#status"),
  openSite: document.querySelector("#open-site"),
};

init();

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab || null;
  if (!currentTab?.url || !/^https?:\/\//i.test(currentTab.url)) {
    elements.pageTitle.textContent = "当前页面不支持收藏";
    elements.siteName.textContent = "请打开普通网页";
    elements.save.disabled = true;
    showStatus("浏览器设置页、扩展页和本地文件不能直接收藏。", "error");
    return;
  }

  const url = new URL(currentTab.url);
  elements.siteName.textContent = url.hostname.replace(/^www\./, "");
  elements.pageTitle.textContent = currentTab.title || "未命名网页";
  elements.pageUrl.textContent = currentTab.url;

  try {
    const [result] = await chrome.scripting.executeScript({ target: { tabId: currentTab.id }, func: () => window.getSelection()?.toString().trim() || "" });
    selection = (result?.result || "").slice(0, 12000);
  } catch {
    selection = "";
  }

  if (selection) {
    elements.modeSelection.disabled = false;
    elements.selectionPreview.textContent = selection;
    setMode("selection");
  }

  const { lastFailedCapture } = await chrome.storage.local.get("lastFailedCapture");
  const failedPayload = lastFailedCapture?.payload;
  const failedUrl = failedPayload?.sourceUrl || failedPayload?.url;
  if (failedUrl === currentTab.url && Date.now() - lastFailedCapture.at < 86_400_000) {
    elements.reason.value = failedPayload.reason || "";
    if (failedPayload.captureType === "selection" && failedPayload.content) {
      selection = failedPayload.content;
      elements.modeSelection.disabled = false;
      elements.selectionPreview.textContent = selection;
      setMode("selection");
    }
    showStatus("已恢复上次未成功保存的内容，可以直接重试。", "duplicate");
  }
}

elements.modePage.addEventListener("click", () => setMode("page"));
elements.modeSelection.addEventListener("click", () => { if (selection) setMode("selection"); });
elements.openSite.addEventListener("click", () => chrome.tabs.create({ url: SITE_URL }));
elements.save.addEventListener("click", saveCapture);

function setMode(nextMode) {
  mode = nextMode;
  elements.modePage.classList.toggle("active", mode === "page");
  elements.modeSelection.classList.toggle("active", mode === "selection");
  elements.selectionCard.hidden = mode !== "selection";
}

async function saveCapture() {
  if (!currentTab?.url) return;
  const reason = elements.reason.value.trim();
  const payload = mode === "selection"
    ? { captureType: "selection", title: `摘录 · ${currentTab.title || "未命名网页"}`, content: selection, sourceUrl: currentTab.url, reason }
    : { url: currentTab.url, content: currentTab.url, kind: "链接", reason };

  elements.save.disabled = true;
  elements.save.textContent = mode === "selection" ? "正在整理摘录…" : "正在提取网页…";
  hideStatus();

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 409) {
      await chrome.storage.local.remove("lastFailedCapture");
      showStatus(`已经收藏过：${data.duplicate?.title || currentTab.title}`, "duplicate");
      elements.save.textContent = "已存在于拾迹";
      return;
    }
    if (!response.ok || !data.item) throw new Error(data.error || `保存失败（${response.status}）`);
    const suffix = data.item.processingStatus === "failed" ? "链接已保留，正文暂时无法提取。" : "已进入收件箱并完成自动整理。";
    showStatus(suffix, "success");
    elements.save.textContent = "已收藏 ✓";
    await chrome.storage.local.remove("lastFailedCapture");
    await chrome.runtime.sendMessage({ type: "set-badge", success: true });
  } catch {
    await chrome.storage.local.set({ lastFailedCapture: { payload, at: Date.now() } });
    showStatus("暂时无法连接拾迹。请点击右上角“打开”，完成登录后重试；本次内容已暂存在扩展中。", "error");
    elements.save.disabled = false;
    elements.save.textContent = "重试收藏";
  }
}

function showStatus(message, type) {
  elements.status.hidden = false;
  elements.status.className = `status ${type === "success" ? "" : type}`.trim();
  elements.status.textContent = message;
}

function hideStatus() {
  elements.status.hidden = true;
  elements.status.textContent = "";
}
