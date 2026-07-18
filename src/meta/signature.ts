import { createHmac, timingSafeEqual } from "crypto";
import { config } from "../config";

/**
 * Verifies Meta X-Hub-Signature-256 header against the raw request body.
 */
export function verifyMetaSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (config.SKIP_META_SIGNATURE) {
    return true;
  }

  if (!config.META_APP_SECRET) {
    console.warn("META_APP_SECRET is empty; rejecting webhook signature check");
    return false;
  }

  if (!signatureHeader?.startsWith("sha256=")) {
    return false;
  }

  const expected = createHmac("sha256", config.META_APP_SECRET)
    .update(rawBody)
    .digest("hex");
  const received = signatureHeader.slice("sha256=".length);

  try {
    const expectedBuf = Buffer.from(expected, "utf8");
    const receivedBuf = Buffer.from(received, "utf8");
    if (expectedBuf.length !== receivedBuf.length) {
      return false;
    }
    return timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}
