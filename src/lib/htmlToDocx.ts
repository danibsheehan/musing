import {
  convertInchesToTwip,
  ExternalHyperlink,
  HeadingLevel,
  Paragraph,
  TextRun,
} from "docx";
import type { ParagraphChild } from "docx";

function absoluteUrl(href: string): string {
  if (!href) return "";
  try {
    return new URL(href, window.location.href).href;
  } catch {
    return href;
  }
}

function walkInline(
  node: Node,
  bold: boolean,
  italics: boolean,
  runs: ParagraphChild[]
): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = node.textContent ?? "";
    if (t)
      runs.push(new TextRun({ text: t, bold: bold || undefined, italics: italics || undefined }));
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  const tag = el.tagName.toUpperCase();
  if (tag === "BR") {
    runs.push(new TextRun({ break: 1 }));
    return;
  }
  if (tag === "STRONG" || tag === "B") {
    for (const c of el.childNodes) walkInline(c, true, italics, runs);
    return;
  }
  if (tag === "EM" || tag === "I") {
    for (const c of el.childNodes) walkInline(c, bold, true, runs);
    return;
  }
  if (tag === "A") {
    const href = el.getAttribute("href") ?? "";
    const link = absoluteUrl(href);
    const inner: ParagraphChild[] = [];
    for (const c of el.childNodes) walkInline(c, bold, italics, inner);
    if (inner.length === 0)
      inner.push(
        new TextRun({
          text: el.textContent ?? "",
          bold: bold || undefined,
          italics: italics || undefined,
        })
      );
    runs.push(new ExternalHyperlink({ link: link || href || "about:blank", children: inner }));
    return;
  }
  if (tag === "CODE" || tag === "KBD") {
    runs.push(
      new TextRun({
        text: el.textContent ?? "",
        font: "Consolas",
        bold: bold || undefined,
        italics: italics || undefined,
      })
    );
    return;
  }
  if (tag === "SPAN" || tag === "MARK") {
    for (const c of el.childNodes) walkInline(c, bold, italics, runs);
    return;
  }
  for (const c of el.childNodes) walkInline(c, bold, italics, runs);
}

function inlineRuns(el: Element): ParagraphChild[] {
  const runs: ParagraphChild[] = [];
  for (const c of el.childNodes) walkInline(c, false, false, runs);
  return runs.length ? runs : [new TextRun("")];
}

function paragraphFromInlineElement(el: Element): Paragraph {
  return new Paragraph({ children: inlineRuns(el) });
}

function listToParagraphs(list: Element, ordered: boolean): Paragraph[] {
  const items: Paragraph[] = [];
  let n = 1;
  for (const li of Array.from(list.children)) {
    if (li.tagName.toUpperCase() !== "LI") continue;
    const prefix = ordered ? `${n}. ` : "• ";
    n++;
    const directPs = Array.from(li.querySelectorAll(":scope > p"));
    if (directPs.length > 0) {
      directPs.forEach((p, idx) => {
        const runs: ParagraphChild[] =
          idx === 0 ? [new TextRun(prefix), ...inlineRuns(p)] : inlineRuns(p);
        items.push(new Paragraph({ children: runs }));
      });
      continue;
    }
    const flat = (li.textContent ?? "").replace(/\s+/g, " ").trim();
    items.push(new Paragraph({ text: flat ? `${prefix}${flat}` : prefix.trimEnd() }));
  }
  return items;
}

function elementToDocx(el: Element): Paragraph[] {
  const tag = el.tagName.toUpperCase();
  switch (tag) {
    case "P":
      return [paragraphFromInlineElement(el)];
    case "H1":
      return [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: inlineRuns(el), spacing: { after: 120 } }),
      ];
    case "H2":
      return [
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: inlineRuns(el), spacing: { after: 100 } }),
      ];
    case "H3":
      return [
        new Paragraph({ heading: HeadingLevel.HEADING_3, children: inlineRuns(el), spacing: { after: 80 } }),
      ];
    case "BLOCKQUOTE": {
      const ps = Array.from(el.querySelectorAll(":scope > p"));
      const body = ps.length
        ? ps.map((p) => (p.textContent ?? "").trim()).filter(Boolean).join("\n")
        : (el.textContent ?? "").replace(/\s+/g, " ").trim();
      return [
        new Paragraph({
          indent: { left: convertInchesToTwip(0.25) },
          children: [new TextRun({ text: body || "", italics: true })],
        }),
      ];
    }
    case "PRE":
      return [
        new Paragraph({
          spacing: { before: 120, after: 120 },
          children: [
            new TextRun({
              text: el.textContent ?? "",
              font: "Consolas",
              size: 20,
            }),
          ],
        }),
      ];
    case "HR":
      return [new Paragraph({ thematicBreak: true, children: [new TextRun("")] })];
    case "UL":
      return listToParagraphs(el, false);
    case "OL":
      return listToParagraphs(el, true);
    case "DIV":
      return Array.from(el.childNodes).flatMap((n) => {
        if (n.nodeType === Node.ELEMENT_NODE) return elementToDocx(n as Element);
        if (n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) {
          return [new Paragraph(n.textContent.trim())];
        }
        return [];
      });
    default:
      if (el.childNodes.length) return [new Paragraph({ children: inlineRuns(el) })];
      return [];
  }
}

/** Convert a TipTap HTML fragment into Word blocks (headings, lists, and tables are added elsewhere). */
export function htmlFragmentToDocxBlocks(html: string): Paragraph[] {
  const host = document.createElement("div");
  host.innerHTML = html.trim() || "<p></p>";
  const out: Paragraph[] = [];
  for (const node of Array.from(host.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (t) out.push(new Paragraph({ text: t }));
      continue;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      for (const block of elementToDocx(node as Element)) {
        if (block instanceof Paragraph) out.push(block);
      }
    }
  }
  return out;
}
