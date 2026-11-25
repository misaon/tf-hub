import { colors } from "consola/utils";

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const wideGrapheme =
  /^(?:\p{Extended_Pictographic}|[\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}　-〿！-｠])/u;
const columnGap = "  ";
const minimumColumnWidth = 8;

function graphemeWidth(grapheme: string): number {
  return wideGrapheme.test(grapheme) ? 2 : 1;
}

export function displayWidth(text: string): number {
  let width = 0;

  for (const { segment } of graphemeSegmenter.segment(text)) {
    width += graphemeWidth(segment);
  }

  return width;
}

function truncateToWidth(text: string, maxWidth: number): string {
  if (displayWidth(text) <= maxWidth) {
    return text;
  }

  let truncated = "";
  let width = 0;

  for (const { segment } of graphemeSegmenter.segment(text)) {
    if (width + graphemeWidth(segment) > maxWidth - 1) {
      break;
    }

    truncated += segment;
    width += graphemeWidth(segment);
  }

  return `${truncated}…`;
}

function padToWidth(text: string, width: number): string {
  return `${text}${" ".repeat(Math.max(0, width - displayWidth(text)))}`;
}

// Shrinks the widest columns until the table fits, so rows never wrap into an unreadable mess.
function fitColumnWidths(naturalWidths: number[], availableWidth: number): number[] {
  const widths = [...naturalWidths];
  const gapsWidth = columnGap.length * Math.max(0, widths.length - 1);
  let overflow = widths.reduce((sum, width) => sum + width, gapsWidth) - availableWidth;

  while (overflow > 0) {
    const widest = Math.max(...widths);
    const index = widths.indexOf(widest);
    const shrinkable = widest - minimumColumnWidth;

    if (shrinkable <= 0) {
      break;
    }

    const reduction = Math.min(shrinkable, overflow);
    widths[index] = widest - reduction;
    overflow -= reduction;
  }

  return widths;
}

export function renderTable(
  rows: Record<string, string>[],
  headers: string[],
  availableWidth = Number.POSITIVE_INFINITY,
): string {
  const naturalWidths = headers.map((header) =>
    Math.max(displayWidth(header), ...rows.map((row) => displayWidth(row[header] ?? ""))),
  );
  const columnWidths = fitColumnWidths(naturalWidths, availableWidth);
  const formatRow = (cells: string[]): string =>
    cells
      .map((cell, index) => padToWidth(truncateToWidth(cell, columnWidths[index] ?? 0), columnWidths[index] ?? 0))
      .join(columnGap)
      .trimEnd();

  return [
    colors.bold(formatRow(headers)),
    colors.dim(columnWidths.map((width) => "─".repeat(width)).join(columnGap)),
    ...rows.map((row) => formatRow(headers.map((header) => row[header] ?? ""))),
  ].join("\n");
}
