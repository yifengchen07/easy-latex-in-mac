import { constants } from "node:fs";
import { copyFile, mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInTeXWorkspace } from "./tex.mjs";

const delimiters = [["$$", "$$"], ["\\[", "\\]"], ["\\(", "\\)"], ["$", "$"]];
const displayEnvironment = /^\\begin\s*\{(?:equation|align|alignat|flalign|gather|multline|eqnarray|displaymath)\*?\}/;
const stylesheet = new URL("svg.xsl", import.meta.url);
const maxSvgBytes = 1_500_000;

export class FormulaError extends Error {}

export function validateFormula(input) {
  if (!input || typeof input !== "object" || typeof input.source !== "string") {
    throw new FormulaError("请输入 LaTeX 公式。");
  }
  const { font, style, size, preamble = "" } = input;
  if (!["cm", "times"].includes(font) || !["inline", "display", "raw"].includes(style) ||
    !Number.isInteger(size) || size < 8 || size > 36) {
    throw new FormulaError("请选用有效的字体、排版样式和 8–36 pt 的字号。");
  }
  const source = input.source.replace(/\r\n?/g, "\n").trim();
  if (!source || source.length > 12000 || typeof preamble !== "string" || preamble.length > 12000) {
    throw new FormulaError("公式和导言区各限 12,000 字符，公式不能为空。");
  }
  const header = preamble.replace(/\r\n?/g, "\n").trim();
  for (const value of [source, header]) {
    if (!value.isWellFormed() || /[\u0000-\u0008\u000b-\u001f\ufffe\uffff]/.test(value)) {
      throw new FormulaError("输入中有不支持的控制字符。");
    }
  }
  return { source, preamble: header, font, style, size };
}

const timesPreamble = String.raw`
\usepackage{fontspec}
\usepackage{unicode-math}
\setmainfont{Times New Roman}
\setmathfont{texgyretermes-math.otf}
\setmathfont[range=up/{Latin,latin,num,Greek,greek}]{Times New Roman}
\setmathfont[range=it/{Latin,latin,Greek,greek}]{Times New Roman Italic}
\setmathfont[range=bfup/{Latin,latin,num,Greek,greek}]{Times New Roman Bold}
\setmathfont[range=bfit/{Latin,latin,Greek,greek}]{Times New Roman Bold Italic}
\providecommand{\bm}{\boldsymbol}
`;

function mathBody(source) {
  for (const [open, close] of delimiters) {
    if (source.startsWith(open) && source.endsWith(close) && source.length >= open.length + close.length) {
      return source.slice(open.length, -close.length).trim();
    }
  }
  return source;
}

function makeDocument(formula, block) {
  const classicPackages = formula.font === "cm" ? "\\usepackage{amssymb,bm}" : "";
  const fontSetup = formula.font === "times" ? timesPreamble : "";
  const dimensions = block ? "\\hsize=410bp\\linewidth=\\hsize\\columnwidth=\\hsize\\parindent=0pt" : "";
  return String.raw`\RequirePackage{fix-cm}
\documentclass{article}
\PassOptionsToPackage{dvisvgm}{graphicx,xcolor}
\def\pgfsysdriver{pgfsys-dvisvgm.def}
\usepackage{amsmath}
${classicPackages}
\input{preamble.tex}
${fontSetup}
\newbox\equationbox
\begin{document}
\setbox\equationbox=${block ? "\\vbox" : "\\hbox"}{
${dimensions}
\fontsize{${formula.size}bp}{${formula.size + 4}bp}\selectfont
\input{body.tex}\unskip}
\shipout\hbox{\special{dvisvgm:raw <metadata id='equation-baseline'>{?y}</metadata>}\copy\equationbox}
\end{document}
`;
}

function renderBody(formula, block) {
  if (block) return "% Easy LaTeX\n" + formula.source + "\n\\par\n";
  const mathStyle = formula.style === "display" ? "\\displaystyle" : "\\textstyle";
  return "$" + mathStyle + "\n" + mathBody(formula.source) + "\n$\n";
}

function svgMetrics(svg, rawSvg, block) {
  const [, viewBox = ""] = /<svg\b[^>]*\bviewBox=['"]([^'"]+)['"]/.exec(svg) ?? [];
  const [, baseline = ""] = /<metadata id=['"]equation-baseline['"]>([^<]+)<\/metadata>/.exec(rawSvg) ?? [];
  const [, top, width, height] = viewBox.trim().split(/[\s,]+/).map(Number);
  if (![top, width, height].every(Number.isFinite) || width <= 1 || height <= 1 ||
    !/<(?:path|rect|line|ellipse|circle|polygon|polyline|use|image)\b/.test(svg)) {
    throw new FormulaError("这段 LaTeX 没有生成可插入的图形。");
  }
  if (width > 1600 || height > 900) throw new FormulaError("公式尺寸过大，请拆分公式。");
  const baselineY = Number(baseline);
  const depth = block || !baseline || !Number.isFinite(baselineY)
    ? 0
    : Math.max(0, Math.min(height, top + height - baselineY));
  return { svg, width, height, depth };
}

function explainFailure(error) {
  if (error instanceof FormulaError) return error;
  if (error.code === "ENOENT") {
    return new Error("找不到排版工具。请安装完整的 MacTeX，并确认 macOS 提供 sandbox-exec 和 xsltproc。", { cause: error });
  }
  if (/sandbox-exec:/.test(error.stderr ?? "")) {
    return new Error("macOS 无法启动隔离排版。请直接双击启动文件，再从 Word 打开加载项。", { cause: error });
  }
  if (error.killed || error.signal === "SIGXFSZ" || error.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
    return new FormulaError("排版超时或输出过大，请拆分这段 LaTeX。");
  }
  const diagnostic = /^(?:(?:\.\/)?(body|preamble|formula)\.tex:(\d+): |! )(.+)(?:\n(?!\s*(?:l\.\d+|!|\(|\)|$))([^\n]+))?/m
    .exec(error.stdout ?? "");
  if (diagnostic) {
    const [, file, line, first, continuation] = diagnostic;
    const location = file === "body" ? "公式第 " + Math.max(1, Number(line) - 1) + " 行"
      : file === "preamble" ? "导言区第 " + line + " 行" : "LaTeX";
    const detail = [first, continuation?.trim()].filter(Boolean).join(" ");
    return new FormulaError(location + "：" + detail.slice(0, 600), { cause: error });
  }
  return new Error("无法生成公式图像，请检查 TeX Live 安装及所用宏包。", { cause: error });
}

export async function renderFormula(input) {
  const formula = validateFormula(input);
  const directory = await realpath(await mkdtemp(join(tmpdir(), "easy-latex-")));
  const firstCommand = formula.source.replace(/^(?:\s*%[^\n]*(?:\n|$))*/, "").trimStart();
  const block = formula.style === "raw" || displayEnvironment.test(firstCommand);

  try {
    await Promise.all([
      writeFile(join(directory, "formula.tex"), makeDocument(formula, block)),
      writeFile(join(directory, "preamble.tex"), formula.preamble + "\n"),
      writeFile(join(directory, "body.tex"), renderBody(formula, block)),
    ]);
    const times = formula.font === "times";
    const engine = times ? "xelatex" : "latex";
    const flags = times ? ["-no-pdf"] : [];
    const { stdout } = await runInTeXWorkspace(engine, [
      ...flags, "-no-shell-escape", "-file-line-error", "-interaction=nonstopmode", "-halt-on-error", "formula.tex",
    ], directory);
    if (/Missing character:/.test(stdout)) {
      throw new FormulaError("所选字体缺少公式中的字符。可用 LaTeX 命令输入该符号，或更换字体。");
    }
    const dvi = times ? "formula.xdv" : "formula.dvi";
    if (/^No pages of output\./m.test(stdout)) throw new FormulaError("这段 LaTeX 没有生成可见内容。");
    if (/Output written on formula\.(?:xdv|dvi) \((?:[2-9]|[1-9]\d+) pages/.test(stdout)) {
      throw new FormulaError("一次插入一张公式图，请把多页内容拆开。");
    }
    await runInTeXWorkspace("dvisvgm", [
      "--no-fonts=1", "--exact-bbox", "--bbox=0.65bp", "--cache=none",
      "--no-mktexmf", "--embed-bitmaps", "--output=formula.svg", dvi,
    ], directory);
    const output = join(directory, "formula.svg");
    if ((await stat(output)).size > maxSvgBytes) throw new FormulaError("公式图形过于复杂，请拆分公式。");
    const rawSvg = await readFile(output, "utf8");
    if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(rawSvg)) throw new FormulaError("公式包含无法嵌入 Word 的 SVG 声明。");
    // Install the trusted transform only after the TeX tools have exited.
    await copyFile(stylesheet, join(directory, "svg.xsl"), constants.COPYFILE_EXCL);
    const { stdout: svg } = await runInTeXWorkspace("xsltproc", [
      "--nonet", "--novalid", "--nodtdattr", "--nowrite", "svg.xsl", "formula.svg",
    ], directory);
    return { ...formula, ...svgMetrics(svg, rawSvg, block) };
  } catch (error) {
    throw explainFailure(error);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
