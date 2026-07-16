/* global chrome */
const API_URL = "https://tracenest-memory.luoxinrong2026.chatgpt.site/api/items";
const SITE_URL = "https://tracenest-memory.luoxinrong2026.chatgpt.site";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "tracenest-save-page", title: "保存当前网页到拾迹", contexts: ["page"] });
    chrome.contextMenus.create({ id: "tracenest-save-selection", title: "保存选中文字到拾迹", contexts: ["selection"] });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.url || !/^https?:\/\//i.test(tab.url)) {
    await showResult("当前页面不支持收藏", "请在普通网页中使用拾迹。", false);
    return;
  }

  const selection = info.menuItemId === "tracenest-save-selection" ? (info.selectionText || "").trim() : "";
  const payload = selection
    ? { captureType: "selection", title: `摘录 · ${tab.title || "未命名网页"}`, content: selection, sourceUrl: tab.url, reason: "浏览器划词摘录" }
    : { url: tab.url, content: tab.url, kind: "链接", reason: "浏览器右键收藏" };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 409) {
      await showResult("已经收藏过", data.duplicate?.title || "这条内容已在拾迹中。", true);
      return;
    }
    if (!response.ok || !data.item) throw new Error(data.error || `保存失败（${response.status}）`);
    const detail = data.item.processingStatus === "failed" ? "链接已保存，正文稍后可重新处理。" : data.item.title;
    await showResult(selection ? "摘录已保存" : "网页已保存", detail, true);
  } catch {
    await chrome.storage.local.set({ lastFailedCapture: { payload, at: Date.now() } });
    await showResult("暂时无法保存", "请先打开拾迹并登录，然后重试。", false);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "open-tracenest") chrome.tabs.create({ url: SITE_URL });
  if (message?.type === "set-badge") setBadge(Boolean(message.success));
  sendResponse({ ok: true });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "tracenest-clear-badge") chrome.action.setBadgeText({ text: "" });
});

async function showResult(title, message, success) {
  await chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon-128.png",
    title,
    message,
    priority: success ? 1 : 2,
  });
  await setBadge(success);
}

async function setBadge(success) {
  await chrome.action.setBadgeBackgroundColor({ color: success ? "#7E8E78" : "#B86F52" });
  await chrome.action.setBadgeText({ text: success ? "✓" : "!" });
  await chrome.alarms.create("tracenest-clear-badge", { delayInMinutes: 0.1 });
}
