import { previewUrl, readSelection, renderPng, writeFormula } from "./word.mjs";

const form = document.querySelector("#equation");
const source = document.querySelector("#source");
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
const status = document.querySelector("#status");

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
  const input = { source: source.value, font: font.value, style: style.value, size: size.valueAsNumber };
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
  for (const field of [source, font, style, size]) field.disabled = true;
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
    for (const field of [source, font, style, size]) field.disabled = false;
    syncButtons();
  }
}

source.addEventListener("input", queuePreview);
size.addEventListener("input", queuePreview);
style.addEventListener("change", queuePreview);
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
    font.value = formula.font;
    style.value = formula.style;
    size.value = formula.size;
    fontNote.hidden = font.value !== "times";
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
