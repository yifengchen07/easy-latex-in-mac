import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { ClipboardError, useClipboard } from "./lib/clipboard.mjs";
import { FormulaError, renderFormula } from "./lib/latex.mjs";

const host = "127.0.0.1";
const port = 43127;
const origin = "http://" + host + ":" + port;
const maxRequestBytes = 96 * 1024;
const files = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/app.mjs", ["app.mjs", "text/javascript; charset=utf-8"]],
  ["/word.mjs", ["word.mjs", "text/javascript; charset=utf-8"]],
  ["/style.css", ["style.css", "text/css; charset=utf-8"]],
]);

const securityHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; script-src 'self' https://officeapis.public.onecdn.static.microsoft; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; base-uri 'none'; form-action 'none'",
};

function json(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  let length = 0;
  const chunks = [];
  for await (const chunk of request) {
    length += chunk.length;
    if (length > maxRequestBytes) throw new FormulaError("输入过长。");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new FormulaError("请求的格式有误。");
  }
}

let activeRenders = 0;
const server = createServer({ requestTimeout: 20_000 }, async (request, response) => {
  for (const [name, value] of Object.entries(securityHeaders)) response.setHeader(name, value);

  if (request.headers.host !== host + ":" + port) {
    json(response, 403, { error: "请从 Word 的 Easy LaTeX 任务窗格打开。" });
    return;
  }

  try {
    // Word adds host information to the task pane URL as query parameters.
    const asset = files.get(request.url.split("?", 1)[0]);
    if (request.method === "POST" && ["/render", "/clipboard"].includes(request.url)) {
      if (request.headers.origin !== origin ||
        request.headers["content-type"] !== "application/json" ||
        request.headers["x-easy-latex"] !== "1") {
        json(response, 403, { error: "请从 Easy LaTeX 任务窗格操作。" });
        return;
      }
      if (Number(request.headers["content-length"]) > maxRequestBytes) {
        json(response, 413, { error: "输入过长。" });
        return;
      }
      if (request.url === "/clipboard") {
        json(response, 200, await useClipboard(await readJson(request)));
        return;
      }
      if (activeRenders >= 2) {
        json(response, 429, { error: "排版正忙，请稍后重试。" });
        return;
      }
      activeRenders++;
      try {
        json(response, 200, await renderFormula(await readJson(request)));
      } finally {
        activeRenders--;
      }
    } else if (request.method === "GET" && asset) {
      const [file, type] = asset;
      const content = await readFile(new URL("./web/" + file, import.meta.url));
      response.writeHead(200, { "Content-Type": type });
      response.end(content);
    } else {
      json(response, 404, { error: "页面不存在。" });
    }
  } catch (error) {
    const status = error instanceof FormulaError || error instanceof ClipboardError ? 422 : 500;
    if (status === 500) console.error(error.message);
    json(response, status, { error: error.message });
  }
});

server.on("error", (error) => {
  console.error("无法启动 Easy LaTeX：" + error.message);
  process.exitCode = 1;
});
server.listen(port, host, () => console.log("Easy LaTeX 已启动 · " + origin));
