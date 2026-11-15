import { execFile } from "node:child_process";

export class ClipboardError extends Error {}

function runClipboard(command, args, input) {
  return new Promise((resolve, reject) => {
    const child = execFile(command, args, {
      env: { ...process.env, LC_ALL: "en_US.UTF-8" },
      timeout: 2500,
      maxBuffer: 96 * 1024,
    }, (error, text) => {
      if (!error) resolve(text);
      else if (error.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
        reject(new ClipboardError("剪贴板中的文字太长，请分段粘贴。"));
      } else {
        reject(new Error("无法连接 Mac 剪贴板，请在终端重新启动 Easy LaTeX。"));
      }
    });
    // execFile reports launch/exit failures through its callback.
    child.stdin?.on("error", () => {});
    child.stdin?.end(input);
  });
}

export async function useClipboard(request) {
  if (request?.action === "copy" && typeof request.text === "string" && request.text.length > 0 &&
    request.text.length <= 12000 && request.text.isWellFormed()) {
    await runClipboard("/usr/bin/pbcopy", [], request.text);
    return { copied: true };
  }
  if (request?.action === "paste") {
    const text = await runClipboard("/usr/bin/pbpaste", ["-Prefer", "txt"]);
    // pbpaste can return rich text or EPS when the pasteboard has no plain text.
    if (!text || /^(?:\{\\rtf\d|%!PS-Adobe-[^\n]*EPSF-)/.test(text)) {
      throw new ClipboardError("剪贴板中没有可粘贴的纯文本。");
    }
    return { text };
  }
  throw new ClipboardError("剪贴板请求格式有误。");
}
