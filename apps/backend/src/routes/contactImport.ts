import { extname } from "node:path";
import type { NextFunction, Request, Response } from "express";
import multer, { MulterError } from "multer";
import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import { bulkContactsRoute } from "./contacts.js";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_CONTACT_ROWS = 500;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1, fields: 8, parts: 10 },
});

export class ContactImportError extends Error {}

function canonicalHeader(header: string): string {
  const normalized = header.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const aliases: Record<string, string> = {
    name: "fullName",
    fullname: "fullName",
    firstname: "fullName",
    phone: "phoneNumber",
    phonenumber: "phoneNumber",
    mobile: "phoneNumber",
    mobilenumber: "phoneNumber",
    emailaddress: "email",
    company: "companyName",
    companyname: "companyName",
    title: "jobTitle",
    jobtitle: "jobTitle",
    donotcall: "optOut",
    optout: "optOut",
    optoutstatus: "optOut",
  };
  return aliases[normalized] ?? header.trim();
}

function validateHeaders(headers: unknown[]): string[] {
  if (headers.length === 0 || headers.length > 64) {
    throw new ContactImportError("The file must have between 1 and 64 columns");
  }

  const result = headers.map((header) => {
    if (typeof header !== "string" || header.trim().length === 0) {
      throw new ContactImportError("Every column must have a non-empty text header");
    }
    return canonicalHeader(header);
  });

  if (!result.some((header) => header === "phoneNumber")) {
    throw new ContactImportError("A phone, mobile, or phoneNumber column is required");
  }
  if (new Set(result).size !== result.length) {
    throw new ContactImportError("Column names must be unique after normalization");
  }
  return result;
}

function recordsFromMatrix(matrix: unknown[][]): Record<string, unknown>[] {
  if (matrix.length < 2) {
    throw new ContactImportError("The file must contain a header row and at least one contact");
  }
  if (matrix.length - 1 > MAX_CONTACT_ROWS) {
    throw new ContactImportError(`A file may contain at most ${MAX_CONTACT_ROWS} contact rows`);
  }

  const headers = validateHeaders(matrix[0]!);
  return matrix.slice(1).map((values, index) => {
    if (values.length > headers.length) {
      throw new ContactImportError(`Row ${index + 2} contains more values than the header row`);
    }
    return Object.fromEntries(headers.map((header, columnIndex) => {
      const value = values[columnIndex] ?? "";
      if (header !== "optOut") return [header, value];
      if (typeof value === "boolean") return [header, value];
      const normalized = String(value).trim().toLowerCase();
      if (["true", "1", "yes", "y", "do not call", "do_not_call"].includes(normalized)) {
        return [header, true];
      }
      if (["", "false", "0", "no", "n", "call"].includes(normalized)) {
        return [header, false];
      }
      throw new ContactImportError(`Row ${index + 2} has an unrecognized opt-out value`);
    }));
  });
}

export async function parseContactUpload(
  buffer: Buffer,
  filename: string,
): Promise<Record<string, unknown>[]> {
  const extension = extname(filename).toLowerCase();

  if (extension === ".csv") {
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      throw new ContactImportError("CSV files must use valid UTF-8 encoding");
    }
    if (text.includes("\0")) {
      throw new ContactImportError("CSV file contains invalid binary data");
    }

    let matrix: unknown[][];
    try {
      matrix = parse(text, {
        bom: true,
        skip_empty_lines: true,
        trim: true,
        to: MAX_CONTACT_ROWS + 2,
        max_record_size: 64 * 1024,
      }) as unknown[][];
    } catch (err: unknown) {
      throw new ContactImportError(err instanceof Error ? `Invalid CSV: ${err.message}` : "Invalid CSV file");
    }
    return recordsFromMatrix(matrix);
  }

  if (extension === ".xlsx") {
    if (buffer.subarray(0, 4).toString("hex") !== "504b0304") {
      throw new ContactImportError("The uploaded XLSX file is not a valid Excel workbook");
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer);
    } catch (err: unknown) {
      throw new ContactImportError(err instanceof Error ? `Invalid XLSX: ${err.message}` : "Invalid XLSX file");
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new ContactImportError("The workbook does not contain a worksheet");
    }
    if (worksheet.actualRowCount > MAX_CONTACT_ROWS + 1 || worksheet.actualColumnCount > 64) {
      throw new ContactImportError(`The workbook may contain at most ${MAX_CONTACT_ROWS} contacts and 64 columns`);
    }

    const matrix: unknown[][] = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values = row.values as unknown[];
      const cells = values.slice(1).map((value) => {
        if (value && typeof value === "object") {
          if ("formula" in value || "sharedFormula" in value) {
            throw new ContactImportError("Formula cells are not supported; replace them with their values");
          }
          if ("text" in value && typeof value.text === "string") return value.text;
          if ("richText" in value && Array.isArray(value.richText)) {
            return value.richText.map((part) => "text" in part ? part.text : "").join("");
          }
          if ("result" in value) return value.result;
          if (value instanceof Date) return value.toISOString();
          throw new ContactImportError("The workbook contains an unsupported cell value");
        }
        return value ?? "";
      });
      matrix.push(cells);
    });
    return recordsFromMatrix(matrix);
  }

  throw new ContactImportError("Only .csv and .xlsx files are supported");
}

export function contactImportUpload(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof MulterError) {
      const uploadError = err;
      const status = uploadError.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      return res.status(status).json({ ok: false, error: uploadError.message });
    }
    return next(err);
  });
}

export async function importContactsFileRoute(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: "A CSV or XLSX file is required in the 'file' field" });
    }
    const contactRows = await parseContactUpload(req.file.buffer, req.file.originalname);
    req.body = {
      clientId: req.clientId,
      label: req.file.originalname.slice(0, 255),
      contacts: contactRows,
      autoEnqueue: req.body?.autoEnqueue === "true",
      campaignId: req.body?.campaignId,
      scheduledFor: req.body?.scheduledFor,
    };
    return await bulkContactsRoute(req, res);
  } catch (err: unknown) {
    if (err instanceof ContactImportError) {
      return res.status(400).json({ ok: false, error: err.message });
    }
    return next(err);
  }
}
