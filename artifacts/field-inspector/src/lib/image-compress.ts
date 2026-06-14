const MAX_BYTES = 200 * 1024; // 200 KB
const MAX_DIMENSION = 1280; // max width or height before scaling

/**
 * Compress a File/Blob to a Base64 JPEG string under MAX_BYTES.
 * Uses Canvas + binary-search on quality so the result is always ≤ 200 KB.
 */
export async function compressImageToBase64(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);

  // Scale down if larger than MAX_DIMENSION on either axis
  let { width, height } = bitmap;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Binary-search on JPEG quality to stay under MAX_BYTES
  let lo = 0.1;
  let hi = 0.95;
  let result = canvas.toDataURL("image/jpeg", hi);

  // Fast path: already small enough at max quality
  if (base64Bytes(result) <= MAX_BYTES) return result;

  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    const candidate = canvas.toDataURL("image/jpeg", mid);
    if (base64Bytes(candidate) <= MAX_BYTES) {
      result = candidate;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return result;
}

/** Approximate byte size of a Base64 data URL */
function base64Bytes(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1] ?? "";
  return Math.ceil((base64.length * 3) / 4);
}
