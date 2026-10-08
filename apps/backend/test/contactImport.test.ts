import assert from "node:assert/strict";
import { test } from "node:test";
import ExcelJS from "exceljs";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/folio";

const { ContactImportError, parseContactUpload } = await import("../src/routes/contactImport.js");

test("parses CSV aliases and normalizes opt-out values", async () => {
  const contacts = await parseContactUpload(
    Buffer.from("Name,Mobile,Do Not Call\nAda Lovelace,+14155550123,yes\n", "utf8"),
    "contacts.csv",
  );

  assert.deepEqual(contacts, [{ fullName: "Ada Lovelace", phoneNumber: "+14155550123", optOut: true }]);
});

test("rejects duplicate normalized headers and malformed opt-out values", async () => {
  await assert.rejects(
    parseContactUpload(Buffer.from("Phone,Mobile\n+14155550123,+14155550124\n"), "contacts.csv"),
    ContactImportError,
  );
  await assert.rejects(
    parseContactUpload(Buffer.from("Phone,Opt Out\n+14155550123,sometimes\n"), "contacts.csv"),
    ContactImportError,
  );
});

test("rejects invalid UTF-8 and unsupported file types", async () => {
  await assert.rejects(parseContactUpload(Buffer.from([0xff, 0xfe]), "contacts.csv"), ContactImportError);
  await assert.rejects(parseContactUpload(Buffer.from("content"), "contacts.xls"), ContactImportError);
});

test("rejects formula cells in XLSX workbooks", async () => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Contacts");
  worksheet.addRow(["Name", "Phone"]);
  worksheet.addRow(["Ada Lovelace", { formula: "1+1", result: 2 }]);
  const content = await workbook.xlsx.writeBuffer();

  await assert.rejects(
    parseContactUpload(Buffer.from(content), "contacts.xlsx"),
    ContactImportError,
  );
});

test("rejects files with more contacts than the import cap", async () => {
  const rows = ["Name,Phone"];
  for (let index = 0; index < 501; index++) {
    rows.push(`Contact ${index},+1415555${String(index).padStart(4, "0")}`);
  }

  await assert.rejects(
    parseContactUpload(Buffer.from(rows.join("\n")), "contacts.csv"),
    ContactImportError,
  );
});
