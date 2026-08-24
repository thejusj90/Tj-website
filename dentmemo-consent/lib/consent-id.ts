import { randomBytes } from "crypto";

export function createConsentRef(date = new Date()) {
  const year = date.getUTCFullYear();
  const token = randomBytes(4).toString("hex").toUpperCase();
  return `DC-${year}-${token}`;
}
