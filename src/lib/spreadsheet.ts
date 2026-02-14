import { parse } from "csv-parse/browser/esm/sync";

export type WordEntry = {
  id: string;
  category: string;
  word: string;
  reading: string;
  imageUrl?: string;
};

const getFieldValue = (row: Record<string, string>, keys: string[]): string => {
  for (const key of keys) {
    if (row[key]) {
      return row[key];
    }
  }
  return "";
};

const normalizeRowKeys = (
  row: Record<string, string>
): Record<string, string> => {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.trim(),
      String(value ?? "").trim()
    ])
  );
};

export const normalizeReading = (value: string): string => {
  return value.replace(/\s+/g, "").trim();
};

export const buildSpreadsheetCsvUrl = (input: string): string => {
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.includes("format=csv") || trimmed.endsWith(".csv")) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
    if (!match) {
      return trimmed;
    }

    const id = match[1];
    const exportUrl = new URL(
      `https://docs.google.com/spreadsheets/d/${id}/export`
    );
    exportUrl.searchParams.set("format", "csv");

    const gid = url.searchParams.get("gid");
    if (gid) {
      exportUrl.searchParams.set("gid", gid);
    }

    return exportUrl.toString();
  } catch {
    return trimmed;
  }
};

export const parseSpreadsheetCsv = (csvText: string): WordEntry[] => {
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as Array<Record<string, string>>;

  return records
    .map((row, index) => {
      const normalizedRow = normalizeRowKeys(row);
      const category =
        getFieldValue(normalizedRow, ["カテゴリ", "category"]) || "未分類";
      const word = getFieldValue(normalizedRow, ["単語", "word"]);
      const reading = getFieldValue(normalizedRow, ["読み", "reading"]);
      const imageUrl = getFieldValue(normalizedRow, ["画像", "image"]);

      if (!word || !reading) {
        return null;
      }

      const entry: WordEntry = {
        id: `${category}-${word}-${index}`,
        category,
        word,
        reading,
        ...(imageUrl ? { imageUrl } : {})
      };

      return entry;
    })
    .filter((entry): entry is WordEntry => entry !== null);
};
