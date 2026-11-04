import { createHash } from "node:crypto";
export const receiptLimit = 2097152;
export function receiptInfo(bytes: Buffer) {
  if (!bytes.length || bytes.length > receiptLimit) return null;
  const mime =
    bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))
      ? "application/pdf"
      : bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))
        ? "image/png"
        : bytes.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"))
          ? "image/jpeg"
          : null;
  return mime
    ? {
        mime,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        size_bytes: bytes.length,
      }
    : null;
}
