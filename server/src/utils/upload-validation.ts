import { badRequest } from "../errors/api-error.js";

const MIME_EXTENSIONS: Readonly<Record<string, ReadonlySet<string>>> = {
  "application/pdf": new Set(["pdf"]),
  "application/zip": new Set(["zip"]),
  "application/json": new Set(["json"]),
  "text/plain": new Set(["txt", "md", "log"]),
  "text/csv": new Set(["csv"]),
  "image/jpeg": new Set(["jpg", "jpeg"]),
  "image/png": new Set(["png"]),
  "image/webp": new Set(["webp"]),
  "image/gif": new Set(["gif"]),
  "video/mp4": new Set(["mp4"]),
  "video/webm": new Set(["webm"]),
  "audio/mpeg": new Set(["mp3"]),
  "audio/mp4": new Set(["m4a", "mp4"]),
  "audio/wav": new Set(["wav"]),
};

export function assertFileNameMatchesMime(fileName: string, mimeType: string): void {
  let decoded = fileName;
  try { decoded = decodeURIComponent(fileName); } catch { /* Invalid percent escapes remain literal. */ }
  const normalized = decoded.normalize("NFKC").toLowerCase();
  if (/[\\/\u0000-\u001f\u007f]/.test(normalized)) throw badRequest("INVALID_FILE_NAME", "The file name must not contain path separators or control characters.");
  const extension = normalized.includes(".") ? normalized.split(".").pop() ?? "" : "";
  const allowed = MIME_EXTENSIONS[mimeType.trim().toLowerCase()];
  if (!allowed || !allowed.has(extension)) throw badRequest("FILE_TYPE_MISMATCH", "The file extension does not match the declared MIME type.");
}
