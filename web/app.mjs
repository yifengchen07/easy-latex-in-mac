import { previewUrl, readSelection, renderPng, writeFormula } from "./word.mjs";

const form = document.querySelector("#equation");
const source = document.querySelector("#source");
const preamble = document.querySelector("#preamble");
const preambleSection = document.querySelector("#preamble-section");
const font = document.querySelector("#font");
const style = document.querySelector("#style");
const size = document.querySelector("#size");
const read = document.querySelector("#read");
const insert = document.querySelector("#insert");
const update = document.querySelector("#update");
const preview = document.querySelector("#preview");
const previewImage = document.querySelector("#preview-image");
const previewPlaceholder = document.querySelector("#preview-placeholder");
const fontNote = document.querySelector("#font-note");
const styleNote = document.querySelector("#style-note");
const status = document.querySelector("#status");
const editors = [source, preamble, font, style, size];
const clipboardButtons = document.querySelectorAll("[data-clipboard]");

let wordReady = false;
let writing = false;
let editTitle = null;
let timer = null;
let currentRender = null;
let displayedUrl = null;
let shownRender = null;

function setStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle("error", error);
}

function syncButtons() {
  insert.disabled = !wordReady || writing || !source.value.trim();
  read.disabled = !wordReady || writing;
  update.hidden = !editTitle;
  update.disabled = !wordReady || writing || !source.value.trim();
  for (const button of clipboardButtons) button.disabled = writing;
}

async function clipboardRequest(action, text) {
  const response = await fetch("/clipboard", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Easy-LaTeX": "1" },
    body: JSON.stringify({ action, text }),
  }).catch(() => {
    throw new Error("无法连接本机服务，请重新启动 Easy LaTeX。");
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

async function editClipboard(field, action, selectionOnly = false) {
  if (field.disabled) return;
  try {
    if (action === "copy") {
      const selected = field.value.slice(field.selectionStart, field.selectionEnd);
      const text = selected || (selectionOnly ? "" : field.value);
      if (text) {
        await clipboardRequest("copy", text);
        setStatus("已复制到剪贴板。");
      }
      return;
    }

    field.focus();
    const { value, selectionStart, selectionEnd } = field;
    const { text } = await clipboardRequest("paste");
    if (field.disabled || document.activeElement !== field || field.value !== value ||
      field.selectionStart !== selectionStart || field.selectionEnd !== selectionEnd) return;
    const pasted = text.replace(/\r\n?/g, "\n");
    if (value.length - (selectionEnd - selectionStart) + pasted.length > field.maxLength) {
      throw new Error("粘贴后会超过输入框的字符上限，请缩短文字。");
    }
    // The WebView's editing command keeps the paste in the text field's undo history.
    try {
      if (document.execCommand("insertText", false, pasted)) return;
    } catch {
      // Some embedded browsers disable this command.
    }
    field.setRangeText(pasted, selectionStart, selectionEnd, "end");
    field.dispatchEvent(new Event("input", { bubbles: true }));
  } catch (error) {
    setStatus(error.message, true);
  }
}

function requestFormula(input, signal) {
  return fetch("/render", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Easy-LaTeX": "1" },
    body: JSON.stringify(input),
    signal,
  }).catch((error) => {
    if (error.name === "AbortError") throw error;
    throw new Error("无法连接本机排版服务，请检查 Easy LaTeX 是否在运行。");
  }).then(async (response) => {
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "排版失败。");
    return result;
  });
}

function renderCurrent() {
  const input = { source: source.value, preamble: preamble.value, font: font.value, style: style.value, size: size.valueAsNumber };
  if (!source.value.trim()) return Promise.reject(new Error("请输入 LaTeX 公式。"));
  if (!size.validity.valid) return Promise.reject(new Error("请输入 8–36 pt 的整数字号。"));
  const key = JSON.stringify(input);
  if (currentRender?.key === key) return currentRender.promise;
  currentRender?.controller.abort();
  const controller = new AbortController();
  const promise = requestFormula(input, controller.signal).catch((error) => {
    if (currentRender?.promise === promise) currentRender = null;
    throw error;
  });
  currentRender = { key, controller, promise };
  return promise;
}

function clearPreview() {
  if (displayedUrl) URL.revokeObjectURL(displayedUrl);
  displayedUrl = null;
  shownRender = null;
  previewImage.hidden = true;
  previewImage.removeAttribute("src");
  previewPlaceholder.hidden = false;
}

function showPreview(formula) {
  if (shownRender === formula) return;
  clearPreview();
  displayedUrl = previewUrl(formula.svg);
  shownRender = formula;
  previewImage.src = displayedUrl;
  previewImage.hidden = false;
  previewPlaceholder.hidden = true;
}

async function refreshPreview() {
  if (!source.value.trim() || writing) return;
  preview.setAttribute("aria-busy", "true");
  const request = renderCurrent();
  try {
    const formula = await request;
    if (currentRender?.promise !== request) return;
    showPreview(formula);
    setStatus(wordReady ? "" : "打开 Word 中的 Easy LaTeX 以插入公式。");
  } catch (error) {
    if (error.name !== "AbortError") {
      clearPreview();
      setStatus(error.message, true);
    }
  } finally {
    preview.setAttribute("aria-busy", "false");
  }
}

function queuePreview() {
  clearTimeout(timer);
  currentRender?.controller.abort();
  currentRender = null;
  clearPreview();
  syncButtons();
  setStatus("");
  if (source.value.trim()) timer = setTimeout(refreshPreview, 350);
}

async function insertOrUpdate(replaceTitle) {
  if (writing) return;
  writing = true;
  clearTimeout(timer);
  syncButtons();
  for (const field of editors) field.disabled = true;
  setStatus("正在排版并写入 Word…");
  try {
    const formula = await renderCurrent();
    showPreview(formula);
    await writeFormula(formula, await renderPng(formula), replaceTitle);
    editTitle = null;
    setStatus(replaceTitle ? "已更新所选公式。" : "已插入公式。");
  } catch (error) {
    setStatus(error.message || "Word 无法写入公式，请检查文档是否可编辑。", true);
  } finally {
    writing = false;
    for (const field of editors) field.disabled = false;
    syncButtons();
  }
}

source.addEventListener("input", queuePreview);
preamble.addEventListener("input", queuePreview);
for (const button of clipboardButtons) {
  const field = document.getElementById(button.getAttribute("aria-controls"));
  button.addEventListener("click", () => editClipboard(field, button.dataset.clipboard));
}
for (const field of [source, preamble]) {
  field.addEventListener("keydown", (event) => {
    if (event.isComposing || !(event.metaKey || event.ctrlKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key !== "c" && key !== "v") return;
    event.preventDefault();
    event.stopPropagation();
    editClipboard(field, key === "c" ? "copy" : "paste", true);
  }, { capture: true });
}
size.addEventListener("input", queuePreview);
style.addEventListener("change", () => {
  styleNote.hidden = style.value !== "raw";
  queuePreview();
});
font.addEventListener("change", () => {
  fontNote.hidden = font.value !== "times";
  queuePreview();
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  clearTimeout(timer);
  if (!source.value.trim()) setStatus("请输入 LaTeX 公式。", true);
  else refreshPreview();
});
source.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !insert.disabled) {
    event.preventDefault();
    insertOrUpdate(editTitle);
  }
});
insert.addEventListener("click", () => insertOrUpdate(null));
update.addEventListener("click", () => insertOrUpdate(editTitle));
read.addEventListener("click", async () => {
  try {
    const formula = await readSelection();
    if (!formula) {
      editTitle = null;
      syncButtons();
      setStatus("请在 Word 中选中一个由 Easy LaTeX 插入的公式。", true);
      return;
    }
    source.value = formula.source;
    preamble.value = formula.preamble;
    preambleSection.open = Boolean(formula.preamble);
    font.value = formula.font;
    style.value = formula.style;
    size.value = formula.size;
    fontNote.hidden = font.value !== "times";
    styleNote.hidden = style.value !== "raw";
    editTitle = formula.title;
    queuePreview();
    source.focus();
  } catch (error) {
    setStatus(error.message || "无法读取所选公式。", true);
  }
});

async function connectWord() {
  // The CDN script loads asynchronously so the formula preview also works in a browser on its own.
  const script = document.querySelector("script[async]");
  if (!window.Office) {
    await new Promise((resolve) => {
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", resolve, { once: true });
      setTimeout(resolve, 6000);
    });
  }
  if (window.Office) {
    const { host } = await Office.onReady();
    wordReady = host === Office.HostType.Word && Office.context.requirements.isSetSupported("WordApi", "1.3");
  }
  syncButtons();
  setStatus(wordReady ? "" : "打开 Word 中的 Easy LaTeX 以插入公式。");
}
connectWord().catch(() => setStatus("无法连接 Word。请关闭并重新打开任务窗格。", true));
