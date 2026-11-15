import assert from "node:assert/strict";
import test from "node:test";
import { validateFormula, renderFormula } from "../lib/latex.mjs";
import { formulaFromAltText, formulaOoxml } from "../web/word.mjs";

const input = { source: String.raw`\frac{x_i+\alpha}{\sqrt{1+y^2}}`, font: "cm", style: "inline", size: 12 };

test("checks formula delimiters, commands and environments before calling TeX", () => {
  assert.equal(validateFormula({ ...input, source: "\\[\n" + input.source + "\n\\]" }).source, input.source);
  assert.equal(validateFormula({ ...input, source: String.raw`\begin{pmatrix}1&2\\3&4\end{pmatrix}` }).font, "cm");
  for (const source of [String.raw`\input{file}`, String.raw`\openout0=output`, String.raw`\end{document}`, "x^^5c", "x% comment", "x}{"]) {
    assert.throws(() => validateFormula({ ...input, source }));
  }
});

test("renders real font outlines and preserves the inline baseline", async () => {
  const [cm, times] = await Promise.all([
    renderFormula(input),
    renderFormula({ ...input, font: "times" }),
  ]);
  for (const result of [cm, times]) {
    assert.match(result.svg, /<path\b/);
    assert.doesNotMatch(result.svg, /<text\b|equation-baseline|<image\b/);
    assert.ok(result.width > 0 && result.height > result.depth && result.depth > 1);
  }
  assert.notEqual(cm.svg, times.svg);
  const display = await renderFormula({ ...input, style: "display" });
  assert.ok(display.height > cm.height);
});

test("embeds SVG, fallback and editable source in the same Word fragment", () => {
  const source = "x < y & z\n\t w";
  const size = 12;
  const id = "test-id";
  const xml = formulaOoxml({ ...input, source, width: 40, height: 16, depth: 3.5, svg: "<svg/>" }, "YQ==", id);
  assert.match(xml, /<asvg:svgBlip r:embed="rId2"/);
  assert.match(xml, /<a:blip r:embed="rId1"/);
  assert.match(xml, /w:position w:val="-7"/);
  assert.match(xml, /descr="LaTeX: x &lt; y &amp; z&#10;&#9; w"/);
  const title = "Easy LaTeX|1|test-id|cm|inline|12";
  assert.deepEqual(formulaFromAltText(title, "LaTeX: " + source), { title, source, font: "cm", style: "inline", size });
  assert.equal(formulaFromAltText("Word image", "ordinary image"), null);
});
