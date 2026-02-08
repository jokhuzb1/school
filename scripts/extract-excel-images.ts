import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

const createWorkbook = () => new ExcelJS.Workbook();
type Workbook = ReturnType<typeof createWorkbook>;
type Worksheet = Workbook["worksheets"][number];
type Cell = ReturnType<Worksheet["getCell"]>;

type Args = {
  input: string;
  outDir: string;
  sheet?: string;
  idHeader: string;
  nameHeader?: string;
  requireId: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = { idHeader: "Person ID", requireId: false };
  for (let i = 2; i < argv.length; i++) {
    const current = argv[i];
    if (!current.startsWith("--")) continue;
    const [key, maybeValue] = current.split("=", 2);
    const value = maybeValue ?? argv[i + 1];
    if (maybeValue == null) i++;
    switch (key) {
      case "--input":
        args.input = value;
        break;
      case "--out":
        args.outDir = value;
        break;
      case "--sheet":
        args.sheet = value;
        break;
      case "--id-header":
        args.idHeader = value;
        break;
      case "--name-header":
        args.nameHeader = value;
        break;
      case "--require-id":
        args.requireId = value == null ? true : value !== "false";
        break;
      default:
        throw new Error(`Unknown arg: ${key}`);
    }
  }
  if (!args.input || !args.outDir) {
    throw new Error(
      "Usage: ts-node scripts/extract-excel-images.ts --input <file.xlsx> --out <dir> [--sheet <name>] [--id-header <header>] [--name-header <header>] [--require-id]",
    );
  }
  return args as Args;
}

function toSafeFilename(value: string): string {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

function cellText(cell: Cell | undefined): string {
  if (!cell) return "";
  const v = cell.value as any;
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (v?.text) return String(v.text).trim();
  if (v?.result != null) return String(v.result).trim();
  return String(cell.text ?? "").trim();
}

function getHeaderMap(worksheet: Worksheet): Map<string, number> {
  const map = new Map<string, number>();
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell({ includeEmpty: false }, (cell: Cell, colNumber: number) => {
    const header = cellText(cell);
    if (!header) return;
    map.set(header.toLowerCase(), colNumber);
  });
  return map;
}

function findHeaderRow(
  worksheet: Worksheet,
  preferredIdHeader: string,
): { headerRowNumber: number; headers: Map<string, number> } {
  const preferred = preferredIdHeader.toLowerCase();
  const commonIdHeaders = [
    preferred,
    "person id",
    "personid",
    "person no",
    "person no.",
    "person number",
    "employee no",
    "employee no.",
    "id",
  ];

  for (let rowNumber = 1; rowNumber <= 20; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const headers = new Map<string, number>();
    row.eachCell({ includeEmpty: false }, (cell: Cell, colNumber: number) => {
      const header = cellText(cell);
      if (!header) return;
      headers.set(header.toLowerCase(), colNumber);
    });
    for (const h of commonIdHeaders) {
      if (headers.has(h)) return { headerRowNumber: rowNumber, headers };
    }
  }

  return { headerRowNumber: 1, headers: getHeaderMap(worksheet) };
}

function ensureUniquePath(filePath: string): string {
  if (!fs.existsSync(filePath)) return filePath;
  const ext = path.extname(filePath);
  const base = filePath.slice(0, -ext.length);
  for (let i = 1; i < 10_000; i++) {
    const candidate = `${base}-${i}${ext}`;
    if (!fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`Too many duplicates for ${filePath}`);
}

async function main() {
  const args = parseArgs(process.argv);
  const workbook = createWorkbook();
  await workbook.xlsx.readFile(args.input);

  const worksheet = args.sheet
    ? workbook.worksheets.find((ws: Worksheet) => ws.name === args.sheet)
    : workbook.worksheets[0];
  if (!worksheet) throw new Error("Worksheet not found.");

  const { headerRowNumber, headers } = findHeaderRow(worksheet, args.idHeader);
  const idCol =
    headers.get(args.idHeader.toLowerCase()) ??
    headers.get("person id") ??
    headers.get("personid") ??
    headers.get("person no") ??
    headers.get("person no.") ??
    headers.get("id");
  if (!idCol) {
    const message = `ID header "${args.idHeader}" not found (scanned rows 1-20). Last scanned row=${headerRowNumber}. Found headers: ${Array.from(
      headers.keys(),
    )
      .slice(0, 50)
      .join(", ")}`;
    if (args.requireId) throw new Error(message);
    process.stderr.write(`${message}\nProceeding with row-based filenames.\n`);
  }
  const nameCol = args.nameHeader
    ? headers.get(args.nameHeader.toLowerCase())
    : undefined;

  fs.mkdirSync(args.outDir, { recursive: true });

  const images = worksheet.getImages();
  let exported = 0;

  for (const { imageId, range } of images) {
    const numericImageId =
      typeof (imageId as any) === "string" ? Number(imageId) : (imageId as any);
    const image = workbook.getImage(numericImageId);
    if (!image) continue;

    const tl: any = (range as any).tl ?? (range as any).topLeft;
    const exceljsRow = (tl?.row ?? tl?.nativeRow ?? 0) + 1; // exceljs uses 0-based for anchors
    const row = worksheet.getRow(exceljsRow);
    const personIdRaw = idCol ? cellText(row.getCell(idCol)) : "";
    const personId = toSafeFilename(personIdRaw || `row${exceljsRow}`);

    const nameRaw = nameCol ? cellText(row.getCell(nameCol)) : "";
    const name = nameRaw ? `_${toSafeFilename(nameRaw)}` : "";

    const ext = image.extension ? `.${image.extension}` : ".jpg";
    const outputName = `${personId}${name}${ext}`;
    const outputPath = ensureUniquePath(path.join(args.outDir, outputName));

    const buffer =
      (image.buffer as Buffer | undefined) ??
      (image.base64 ? Buffer.from(image.base64, "base64") : undefined);
    if (!buffer) continue;

    fs.writeFileSync(outputPath, buffer);
    exported++;
  }

  process.stdout.write(
    `Sheet="${worksheet.name}", images=${images.length}, exported=${exported}, out="${args.outDir}"\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`${err?.message ?? err}\n`);
  process.exit(1);
});
