import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import type { Editor } from "@tiptap/react";

// Minimal shape of Tiptap/ProseMirror JSON we walk. We only cover what StarterKit
// actually produces (paragraphs, headings, bullet/ordered lists, bold/italic marks) —
// anything else falls back to a plain paragraph of its text content.
type TiptapMark = { type: string; attrs?: Record<string, unknown> };
type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: TiptapMark[];
};

const HEADING_LEVELS: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
};

function textRunsFor(node: TiptapNode): TextRun[] {
  if (node.type !== "text") return [];
  const bold = node.marks?.some((m) => m.type === "bold") ?? false;
  const italics = node.marks?.some((m) => m.type === "italic") ?? false;
  const strike = node.marks?.some((m) => m.type === "strike") ?? false;
  const code = node.marks?.some((m) => m.type === "code") ?? false;
  return [
    new TextRun({
      text: node.text ?? "",
      bold,
      italics,
      strike,
      font: code ? "Courier New" : undefined,
    }),
  ];
}

function inlineRuns(nodes: TiptapNode[] | undefined): TextRun[] {
  if (!nodes || nodes.length === 0) return [];
  const runs: TextRun[] = [];
  for (const child of nodes) {
    if (child.type === "text") runs.push(...textRunsFor(child));
    else if (child.type === "hardBreak") runs.push(new TextRun({ text: "", break: 1 }));
    else if (child.content) runs.push(...inlineRuns(child.content));
  }
  return runs;
}

function paragraphFor(node: TiptapNode, opts: { bullet?: { level: number }; numbering?: { level: number } } = {}): Paragraph {
  const runs = inlineRuns(node.content);
  return new Paragraph({
    children: runs.length > 0 ? runs : [new TextRun("")],
    bullet: opts.bullet,
    numbering: opts.numbering ? { reference: "relay-ordered-list", level: opts.numbering.level } : undefined,
  });
}

function headingFor(node: TiptapNode): Paragraph {
  const level = Math.min(3, Math.max(1, Number(node.attrs?.level) || 1));
  const runs = inlineRuns(node.content);
  return new Paragraph({
    heading: HEADING_LEVELS[level],
    children: runs.length > 0 ? runs : [new TextRun("")],
  });
}

function listItemsFor(node: TiptapNode, ordered: boolean, level: number): Paragraph[] {
  const out: Paragraph[] = [];
  for (const item of node.content ?? []) {
    if (item.type !== "listItem") continue;
    for (const child of item.content ?? []) {
      if (child.type === "paragraph") {
        out.push(
          paragraphFor(child, ordered ? { numbering: { level } } : { bullet: { level } }),
        );
      } else if (child.type === "bulletList") {
        out.push(...listItemsFor(child, false, level + 1));
      } else if (child.type === "orderedList") {
        out.push(...listItemsFor(child, true, level + 1));
      } else if (child.content) {
        out.push(paragraphFor(child, ordered ? { numbering: { level } } : { bullet: { level } }));
      }
    }
  }
  return out;
}

function nodesToParagraphs(nodes: TiptapNode[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "paragraph":
        paragraphs.push(paragraphFor(node));
        break;
      case "heading":
        paragraphs.push(headingFor(node));
        break;
      case "bulletList":
        paragraphs.push(...listItemsFor(node, false, 0));
        break;
      case "orderedList":
        paragraphs.push(...listItemsFor(node, true, 0));
        break;
      case "blockquote":
        for (const child of node.content ?? []) {
          if (child.type === "paragraph") {
            const runs = inlineRuns(child.content);
            paragraphs.push(
              new Paragraph({
                indent: { left: 360 },
                children: runs.length > 0 ? runs : [new TextRun("")],
              }),
            );
          } else if (child.content) {
            paragraphs.push(...nodesToParagraphs([child]));
          }
        }
        break;
      case "codeBlock": {
        const text = (node.content ?? []).map((n) => n.text ?? "").join("");
        paragraphs.push(new Paragraph({ children: [new TextRun({ text, font: "Courier New" })] }));
        break;
      }
      case "horizontalRule":
        paragraphs.push(new Paragraph({ text: "" }));
        break;
      default: {
        // Unrecognized node — fall back to a plain paragraph of whatever text it contains.
        const runs = inlineRuns(node.content);
        if (runs.length > 0) paragraphs.push(new Paragraph({ children: runs }));
        break;
      }
    }
  }
  return paragraphs;
}

/** Pure function: walks Tiptap/ProseMirror JSON and produces a .docx Blob. Exported for testability. */
export async function tiptapJsonToDocx(json: TiptapNode, title: string): Promise<Blob> {
  const bodyNodes = json.content ?? [];
  const paragraphs = nodesToParagraphs(bodyNodes);

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "relay-ordered-list",
          levels: [
            { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.START },
            { level: 1, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.START },
            { level: 2, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.START },
          ],
        },
      ],
    },
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(title || "Untitled document")] }),
          ...(paragraphs.length > 0 ? paragraphs : [new Paragraph("")]),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function safeFileName(title: string): string {
  return (title || "Untitled document").trim().replace(/[\\/:*?"<>|]+/g, "-").slice(0, 120);
}

export async function downloadAsDocx(editor: Editor, title: string): Promise<void> {
  const json = editor.getJSON() as TiptapNode;
  const blob = await tiptapJsonToDocx(json, title);
  triggerDownload(blob, `${safeFileName(title)}.docx`);
}

export async function downloadAsPdf(element: HTMLElement, title: string): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 32;

  await new Promise<void>((resolve, reject) => {
    pdf.html(element, {
      margin: [margin, margin, margin, margin],
      autoPaging: "text",
      width: pageWidth - margin * 2,
      windowWidth: element.scrollWidth || element.clientWidth || 800,
      callback: (doc) => {
        try {
          doc.save(`${safeFileName(title)}.pdf`);
          resolve();
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      },
    });
  });
}
