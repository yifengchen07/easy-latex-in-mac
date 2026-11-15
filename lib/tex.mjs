import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const profile = fileURLToPath(new URL("tex.sb", import.meta.url));
let installation;

async function findTeX() {
  const bin = await realpath(process.env.EASY_LATEX_TEX_BIN ?? "/Library/TeX/texbin");
  const root = dirname(dirname(bin));
  if (basename(dirname(bin)) !== "bin" || dirname(root) === "/") {
    throw new Error("无法定位 TeX Live。请使用 MacTeX 的 /Library/TeX/texbin 或指定 TeX Live 的架构 bin 目录。");
  }
  return { bin, root, local: join(dirname(root), "texmf-local") };
}

export async function runInTeXWorkspace(tool, args, job) {
  const { bin, root, local } = await (installation ??= findTeX());
  const executable = tool === "xsltproc" ? "/usr/bin/xsltproc" : join(bin, tool);
  const program = await realpath(executable);
  return run("/bin/sh", [
    "-c", 'ulimit -f 32768 && ulimit -t 10 && exec "$@"', "easy-latex",
    "/usr/bin/sandbox-exec", "-f", profile,
    "-D", "JOB=" + job, "-D", "PROGRAM=" + program,
    "-D", "TEX_ROOT=" + root, "-D", "TEX_LOCAL=" + local,
    executable, ...args,
  ], {
    cwd: job,
    env: {
      PATH: "/usr/bin:/bin",
      TMPDIR: job,
      TEXMFHOME: job,
      TEXMFVAR: job,
      TEXMFCONFIG: job,
      openin_any: "p",
      openout_any: "p",
      MKTEXPK: "0",
      MKTEXMF: "0",
      MKTEXTFM: "0",
    },
    timeout: 12_000,
    killSignal: "SIGKILL",
    maxBuffer: 2 * 1024 * 1024,
  });
}
