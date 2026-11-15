import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const texPath = process.env.EASY_LATEX_TEX_BIN ?? "/Library/TeX/texbin";
const commands = new Set(
  ("frac dfrac tfrac binom dbinom tbinom sqrt cfrac overline underline " +
   "hat widehat tilde widetilde bar breve check acute grave vec dot ddot dddot " +
   "overset underset boxed phantom vphantom hphantom " +
   "left right middle big Big bigg Bigg bigl Bigl biggl Biggl bigr Bigr biggr Biggr " +
   "langle rangle lvert rvert lVert rVert lfloor rfloor lceil rceil " +
   "displaystyle textstyle scriptstyle scriptscriptstyle limits nolimits " +
   "text textrm textit textbf textsf texttt mathrm mathit mathbf mathsf mathtt " +
   "mathcal mathbb mathfrak boldsymbol bm operatorname " +
   "alpha beta gamma delta epsilon varepsilon zeta eta theta vartheta iota kappa varkappa " +
   "lambda mu nu xi pi varpi rho varrho sigma varsigma tau upsilon phi varphi chi psi omega " +
   "Gamma Delta Theta Lambda Xi Pi Sigma Upsilon Phi Psi Omega " +
   "cdot times div pm mp ast star circ bullet cap cup uplus sqcap sqcup setminus " +
   "oplus ominus otimes oslash odot wedge vee land lor wr triangleleft triangleright " +
   "sum prod coprod int iint iiint oint bigcap bigcup bigvee bigwedge bigotimes bigoplus " +
   "sin cos tan cot sec csc arcsin arccos arctan sinh cosh tanh coth exp log ln lg " +
   "lim limsup liminf max min sup inf det dim ker hom gcd Pr arg deg " +
   "le leq leqslant ge geq geqslant neq ne approx sim simeq cong equiv propto asymp ll gg prec succ preceq succeq " +
   "in ni notin subset supset subseteq supseteq subsetneq supsetneq parallel perp mid nmid not " +
   "to gets leftarrow rightarrow leftrightarrow longleftarrow longrightarrow longleftrightarrow " +
   "Leftarrow Rightarrow Leftrightarrow Longleftarrow Longrightarrow Longleftrightarrow " +
   "implies iff mapsto longmapsto uparrow downarrow updownarrow Uparrow Downarrow Updownarrow " +
   "nearrow searrow swarrow nwarrow hookleftarrow hookrightarrow xleftarrow xrightarrow " +
   "infty partial nabla forall exists nexists neg emptyset varnothing ell hbar imath jmath Re Im " +
   "aleph wp top bot angle triangle square blacksquare Box checkmark dagger ddagger prime backslash " +
   "ldots cdots vdots ddots dots dotsc dotsb dotsm dotsi " +
   "colon quad qquad enspace thinspace medspace thickspace negthinspace " +
   "substack overbrace underbrace overrightarrow overleftarrow " +
   "mathord mathop mathbin mathrel mathopen mathclose mathpunct")
    .split(" ")
);
const environments = new Set([
  "matrix", "pmatrix", "bmatrix", "Bmatrix", "vmatrix", "Vmatrix",
  "smallmatrix", "cases", "aligned", "gathered", "array",
]);
const symbols = new Set("\\{}|,;:! #$%&_/");
const delimiters = [["$$", "$$"], ["\\[", "\\]"], ["\\(", "\\)"], ["$", "$"]];

export class FormulaError extends Error {}

export function validateFormula(input) {
  if (!input || typeof input !== "object" || typeof input.source !== "string") {
    throw new FormulaError("请输入 LaTeX 公式。");
  }
  const { font, style, size } = input;
  if (!["cm", "times"].includes(font) || !["inline", "display"].includes(style) ||
    !Number.isInteger(size) || size < 8 || size > 36) {
    throw new FormulaError("请选用有效的字体、排版样式和 8–36 pt 的字号。");
  }

  let source = input.source.replace(/\r\n?/g, "\n").trim();
  for (const [open, close] of delimiters) {
    if (source.startsWith(open) && source.endsWith(close) && source.length >= open.length + close.length) {
      source = source.slice(open.length, -close.length).trim();
      break;
    }
  }
  if (!source || source.length > 4000) {
    throw new FormulaError("公式须包含 1–4000 个字符。");
  }
  if (/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]|\^\^/.test(source)) {
    throw new FormulaError("公式中有不支持的控制字符。");
  }

  // Inspect every control sequence using TeX's backslash token boundary.
  // Environment names are checked separately as they dispatch to macros.
  const tokens = /\\(?:([A-Za-z]+)|([\s\S]))|([%$#{}\\])/g;
  let braces = 0;
  for (const match of source.matchAll(tokens)) {
    const [, command, symbol, literal] = match;
    if (literal === "{") braces++;
    else if (literal === "}" && --braces < 0) throw new FormulaError("花括号没有配对。");
    else if (literal && literal !== "}") throw new FormulaError("请只输入公式内容，特殊字符需转义。");

    if (command === "begin" || command === "end") {
      const name = /^\s*\{([a-zA-Z]+)\}/.exec(source.slice(match.index + match[0].length))?.[1];
      if (!environments.has(name)) throw new FormulaError("这个 LaTeX 环境暂不支持。");
    } else if (command && !commands.has(command)) {
      throw new FormulaError("暂不支持命令 " + match[0] + "。");
    } else if (symbol && !symbols.has(symbol)) {
      throw new FormulaError("暂不支持命令 " + match[0] + "。");
    }
  }
  if (braces !== 0) throw new FormulaError("花括号没有配对。");
  return { source, font, style, size };
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
\let\bm\boldsymbol
`;

function makeDocument(formula) {
  const preamble = formula.font === "times"
    ? timesPreamble
    : "\\usepackage{amssymb}\n\\usepackage{bm}";
  const mathStyle = formula.style === "display" ? "\\displaystyle" : "\\textstyle";
  return String.raw`\RequirePackage{fix-cm}
\documentclass{article}
\usepackage{amsmath}
${preamble}
\newbox\equationbox
\begin{document}
\setbox\equationbox=\hbox{\fontsize{${formula.size}bp}{${formula.size + 4}bp}\selectfont
$${mathStyle} ${formula.source}
$}
\shipout\hbox{\special{dvisvgm:raw <metadata id='equation-baseline'>{?y}</metadata>}\copy\equationbox}
\end{document}
`;
}

function svgMetrics(rawSvg) {
  const [, viewBox = ""] = /\bviewBox=['"]([^'"]+)['"]/.exec(rawSvg) ?? [];
  const [, baseline = ""] = /<metadata id=['"]equation-baseline['"]>([^<]+)<\/metadata>/.exec(rawSvg) ?? [];
  const [, top, width, height] = viewBox.split(/\s+/).map(Number);
  if (!baseline || ![top, width, height, Number(baseline)].every(Number.isFinite) ||
    width <= 1 || height <= 1 || !/<(?:path|rect)\b/.test(rawSvg)) {
    throw new FormulaError("公式没有可见内容。");
  }
  if (width > 1600 || height > 900) throw new FormulaError("公式尺寸过大，请拆分公式。");
  return {
    svg: rawSvg.replace(/<metadata id=['"]equation-baseline['"]>[^<]+<\/metadata>/, ""),
    width,
    height,
    depth: Math.max(0, top + height - Number(baseline)),
  };
}

export async function renderFormula(input) {
  const formula = validateFormula(input);
  const directory = await mkdtemp(join(tmpdir(), "easy-latex-"));
  const env = {
    ...process.env,
    PATH: [texPath, process.env.PATH].join(delimiter),
    openin_any: "p",
    openout_any: "p",
  };
  const options = { cwd: directory, env, timeout: 8000, maxBuffer: 256 * 1024 };

  try {
    await writeFile(join(directory, "formula.tex"), makeDocument(formula));
    const times = formula.font === "times";
    const engine = times ? "xelatex" : "latex";
    const flags = times ? ["-no-pdf"] : [];
    const { stdout } = await run(join(texPath, engine), [
      ...flags, "-no-shell-escape", "-interaction=nonstopmode", "-halt-on-error", "formula.tex",
    ], options);
    if (/Missing character:/.test(stdout)) {
      throw new FormulaError("所选字体缺少公式中的字符。请用 LaTeX 命令输入数学符号。");
    }
    await run(join(texPath, "dvisvgm"), [
      "--no-fonts=1", "--exact-bbox", "--bbox=0.65bp", "--cache=none",
      "--output=formula.svg", times ? "formula.xdv" : "formula.dvi",
    ], options);
    const svg = await readFile(join(directory, "formula.svg"), "utf8");
    if (svg.length > 1_500_000) throw new FormulaError("公式的图形过于复杂，请拆分公式。");
    return { ...formula, ...svgMetrics(svg) };
  } catch (error) {
    if (error instanceof FormulaError) throw error;
    if (error.code === "ENOENT") throw new Error("找不到 TeX Live。请确认 /Library/TeX/texbin 中有 latex、xelatex 和 dvisvgm。");
    if (error.killed) throw new FormulaError("排版超时，请缩短公式后重试。");
    const message = /^\s*! (.+)$/m.exec(error.stdout ?? "")?.[1];
    if (/fontspec error|font .*cannot be found/i.test(message ?? "")) {
      throw new Error("无法加载数学字体，请确认 Mac 已安装 Times New Roman 和 TeX Gyre Termes Math。");
    }
    if (message) throw new FormulaError("LaTeX 排版失败：" + message);
    throw new Error("无法生成公式图像，请确认 TeX Live 安装完整。", { cause: error });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
