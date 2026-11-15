import assert from "node:assert/strict";
import { copyFile, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validateFormula, renderFormula } from "../lib/latex.mjs";
import { runInTeXWorkspace } from "../lib/tex.mjs";
import { formulaFromAltText, formulaOoxml } from "../web/word.mjs";

const input = { source: String.raw`\frac{x_i+\alpha}{\sqrt{1+y^2}}`, font: "cm", style: "inline", size: 12 };

test("preserves source delimiters and allows arbitrary TeX commands", () => {
  const source = "\\[\n" + input.source + " % comment\n\\]";
  const preamble = String.raw`\usepackage{mathtools}
\newcommand{\abs}[1]{\lvert #1 \rvert}`;
  assert.deepEqual(validateFormula({ ...input, source, preamble }), { ...input, source, preamble });
  for (const invalid of [{ source: " " }, { source: "a\0b" }, { preamble: 7 }, { preamble: "x".repeat(12001) }]) {
    assert.throws(() => validateFormula({ ...input, ...invalid }));
  }
});

test("renders both font modes and preserves the inline baseline", async () => {
  const [cm, times, display] = await Promise.all([
    renderFormula(input),
    renderFormula({ ...input, font: "times" }),
    renderFormula({ ...input, source: "\\[" + input.source + "\\]", style: "display" }),
  ]);
  for (const result of [cm, times, display]) {
    assert.match(result.svg, /<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    assert.match(result.svg, /<path\b/);
    assert.doesNotMatch(result.svg, /<text\b|equation-baseline|<image\b/);
    assert.ok(result.width > 0 && result.height > result.depth && result.depth > 1);
  }
  assert.notEqual(cm.svg, times.svg);
  assert.ok(display.height > cm.height);
});

test("loads installed packages, defines macros and renders a complete align environment", async () => {
  const preamble = String.raw`\usepackage{mathtools,cancel}
\DeclarePairedDelimiter{\abs}{\lvert}{\rvert}
\newcommand{\norm}[1]{\left\lVert #1\right\rVert}`;
  const source = String.raw`% a complete display environment
\begin{align*}
 f(x) &\coloneqq \abs*{\cancel{x^2}}+\norm{x} \\
 g(x) &= 1 \tag{A}
\end{align*}`;
  const [cm, times] = await Promise.all([
    renderFormula({ ...input, source, preamble }),
    renderFormula({ ...input, source, preamble, font: "times" }),
  ]);
  for (const result of [cm, times]) {
    assert.equal(result.preamble, preamble);
    assert.equal(result.depth, 0);
    assert.ok(result.height > 25 && result.width > 100);
  }
});

test("renders TikZ paths with the vector driver", async () => {
  const result = await renderFormula({
    ...input,
    preamble: String.raw`\usepackage{tikz}`,
    source: String.raw`\begin{tikzpicture}
      \draw[blue, thick, ->] (0,0) -- (2,1) node[right] {$\alpha$};
    \end{tikzpicture}`,
    style: "raw",
  });
  assert.match(result.svg, /stroke="#00f"/);
  assert.ok(result.width > 50 && result.height > 25);
});

test("converts hyperlinked math to artwork without navigation", async () => {
  const result = await renderFormula({
    ...input,
    preamble: String.raw`\usepackage{hyperref}`,
    source: String.raw`\href{https://example.invalid/}{x^2+y^2}`,
  });
  assert.match(result.svg, /<path\b/);
  assert.doesNotMatch(result.svg, /<a\b|example\.invalid/);
});

test("the conversion process cannot read a file outside the job and TeX installation", async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "easy-latex-test-")));
  const job = await realpath(await mkdtemp(join(tmpdir(), "easy-latex-job-")));
  try {
    const outside = join(directory, "fixture.xml");
    const xsl = new URL("../lib/svg.xsl", import.meta.url);
    await writeFile(outside, '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0,0L1,1"/></svg>');
    await copyFile(xsl, join(job, "filter.xsl"));
    await assert.rejects(runInTeXWorkspace("xsltproc", ["--nonet", "filter.xsl", outside], job), (error) => {
      assert.equal(error.code, 6);
      assert.match(error.stderr, /failed to load external entity/);
      return true;
    });
  } finally {
    await Promise.all([rm(directory, { recursive: true }), rm(job, { recursive: true })]);
  }
});

test("stores the preamble and source and reads formulas from v1 documents", () => {
  const source = "x < y & z\n\t w";
  const preamble = String.raw`\newcommand{\E}{\mathbb{E}}`;
  const size = 12;
  const id = "test-id";
  const xml = formulaOoxml({ ...input, source, preamble, width: 40, height: 16, depth: 3.5, svg: "<svg/>" }, "YQ==", id);
  assert.match(xml, /<asvg:svgBlip r:embed="rId2"/);
  assert.match(xml, /<a:blip r:embed="rId1"/);
  assert.match(xml, /w:position w:val="-7"/);
  assert.match(xml, /title="Easy LaTeX\|2\|test-id\|cm\|inline\|12"/);
  const [, description] = /<wp:docPr [^>]*descr="([^"]+)"/.exec(xml);
  const stored = description.replace(/&(?:quot|amp|lt|gt);/g, (match) => ({
    "&quot;": '"', "&amp;": "&", "&lt;": "<", "&gt;": ">",
  })[match]);
  const title = "Easy LaTeX|2|test-id|cm|inline|12";
  assert.deepEqual(formulaFromAltText(title, stored), { title, source, preamble, font: "cm", style: "inline", size });
  const v1Title = "Easy LaTeX|1|old-id|cm|inline|12";
  assert.deepEqual(formulaFromAltText(v1Title, "LaTeX: " + source), {
    title: v1Title, source, preamble: "", font: "cm", style: "inline", size,
  });
  assert.equal(formulaFromAltText("Word image", "ordinary image"), null);
});
