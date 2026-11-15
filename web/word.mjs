const relationshipType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const relationshipsType = "application/vnd.openxmlformats-package.relationships+xml";
const titlePrefix = "Easy LaTeX";
const sourcePrefix = "LaTeX: ";

function escapeXml(value) {
  return value.replace(/[&<>"'\n\t]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;", "\n": "&#10;", "\t": "&#9;",
  })[character]);
}

function svgBlob(svg) {
  return new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
}

export function previewUrl(svg) {
  return URL.createObjectURL(svgBlob(svg));
}

export async function renderPng(formula) {
  const image = new Image();
  const url = previewUrl(formula.svg);
  try {
    image.src = url;
    await image.decode();
    const { width, height } = formula;
    const scale = Math.min(600 / 72, 3500 / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("无法生成备用公式图像。");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const png = canvas.toDataURL("image/png").split(",")[1];
    if (!png) throw new Error("无法生成备用公式图像。");
    return png;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function formulaFromAltText(title, description) {
  if (!title || !description?.startsWith(sourcePrefix)) return null;
  const [prefix, version, id, font, style, size] = title.split("|");
  if (prefix !== titlePrefix || !["1", "2"].includes(version) || !id) return null;
  if (!["cm", "times"].includes(font) || !["inline", "display", "raw"].includes(style) ||
    !/^(?:[89]|[12][0-9]|3[0-6])$/.test(size)) return null;
  const stored = description.slice(sourcePrefix.length);
  if (version === "1") return { title, font, style, size: Number(size), source: stored, preamble: "" };
  try {
    const { source, preamble } = JSON.parse(stored);
    if (typeof source !== "string" || typeof preamble !== "string") return null;
    return { title, font, style, size: Number(size), source, preamble };
  } catch {
    return null;
  }
}

export function formulaOoxml(formula, png, id) {
  const { font, style, size, width, height, depth, source, preamble = "", svg } = formula;
  const title = [titlePrefix, "2", id, font, style, size].join("|");
  const description = escapeXml(sourcePrefix + JSON.stringify({ source, preamble }));
  const svgData = btoa(Array.from(new TextEncoder().encode(svg), (byte) => String.fromCharCode(byte)).join(""));
  const cx = Math.round(width * 12700);
  const cy = Math.round(height * 12700);
  const position = style === "inline" ? -Math.round(depth * 2) : 0;
  const extent = `cx="${cx}" cy="${cy}"`;
  const xmlPart = (name, type, content) =>
    `<pkg:part pkg:name="${name}" pkg:contentType="${type}"><pkg:xmlData>${content}</pkg:xmlData></pkg:part>`;
  const imagePart = (name, type, data) =>
    `<pkg:part pkg:name="/word/media/${name}" pkg:contentType="${type}" pkg:compression="store"><pkg:binaryData>${data}</pkg:binaryData></pkg:part>`;
  const relationship = (id, type, target) => `<Relationship Id="${id}" Type="${relationshipType}/${type}" Target="${target}"/>`;
  const relationships = (entries) =>
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${entries}</Relationships>`;

  return `<pkg:package xmlns:pkg="http://schemas.microsoft.com/office/2006/xmlPackage">
  ${xmlPart("/_rels/.rels", relationshipsType, relationships(relationship("rId1", "officeDocument", "word/document.xml")))}
  ${xmlPart("/word/_rels/document.xml.rels", relationshipsType, relationships(
    relationship("rId1", "image", "media/formula.png") + relationship("rId2", "image", "media/formula.svg")
  ))}
  ${imagePart("formula.png", "image/png", png)}
  ${imagePart("formula.svg", "image/svg+xml", svgData)}
  ${xmlPart("/word/document.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml", `
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
      xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
      xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
      xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"
      xmlns:r="${relationshipType}"
      xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main">
      <w:body>
        <w:p><w:r>
          ${position ? `<w:rPr><w:position w:val="${position}"/></w:rPr>` : ""}
          <w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">
            <wp:extent ${extent}/>
            <wp:docPr id="1" name="LaTeX formula" title="${title}" descr="${description}"/>
            <wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>
            <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:pic>
                <pic:nvPicPr><pic:cNvPr id="0" name="LaTeX formula"/><pic:cNvPicPr/></pic:nvPicPr>
                <pic:blipFill>
                  <a:blip r:embed="rId1">
                    <a:extLst><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}"><asvg:svgBlip r:embed="rId2"/></a:ext></a:extLst>
                  </a:blip>
                  <a:stretch><a:fillRect/></a:stretch>
                </pic:blipFill>
                <pic:spPr>
                  <a:xfrm><a:off x="0" y="0"/><a:ext ${extent}/></a:xfrm>
                  <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                </pic:spPr>
              </pic:pic>
            </a:graphicData></a:graphic>
          </wp:inline></w:drawing>
        </w:r></w:p>
      </w:body>
    </w:document>`)}
</pkg:package>`;
}

async function selectedFormula(context) {
  const pictures = context.document.getSelection().inlinePictures;
  pictures.load("items/altTextTitle,items/altTextDescription");
  await context.sync();
  if (pictures.items.length !== 1) return null;
  const [picture] = pictures.items;
  const formula = formulaFromAltText(picture.altTextTitle, picture.altTextDescription);
  return formula && { picture, formula };
}

export async function readSelection() {
  return Word.run(async (context) => (await selectedFormula(context))?.formula ?? null);
}

export async function writeFormula(formula, png, replaceTitle) {
  const id = crypto.randomUUID();
  const xml = formulaOoxml(formula, png, id);
  return Word.run(async (context) => {
    let target;
    if (replaceTitle) {
      const selection = await selectedFormula(context);
      if (!selection || selection.formula.title !== replaceTitle) {
        throw new Error("请在 Word 中重新选中要更新的公式，然后点击「读取所选公式」。");
      }
      target = selection.picture.getRange();
    } else {
      target = context.document.getSelection().getRange("End");
    }
    const inserted = target.insertOoxml(xml, "Replace");
    inserted.select(replaceTitle ? "Select" : "End");
    await context.sync();
  });
}
