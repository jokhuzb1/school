import { appLogger } from '../../utils/logger';
import { blobToBase64, fileToBase64 } from './base64';

type FaceEncodeOptions = {
  maxBytes: number;
  maxDimension: number;
};

const DEFAULT_FACE_ENCODE: FaceEncodeOptions = {
  maxBytes: 200 * 1024,
  maxDimension: 640,
};

async function fileToImageBitmap(file: File): Promise<ImageBitmap> {
  if ('createImageBitmap' in window) {
    return createImageBitmap(file);
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = dataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(img, 0, 0);
  return createImageBitmap(canvas);
}

async function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Failed to encode image'));
        resolve(blob);
      },
      'image/jpeg',
      quality,
    );
  });
}

/**
 * Encodes a face image as base64 JPEG and tries to keep it under 200KB.
 * This helps Hikvision devices that enforce small face image size limits.
 */
export async function fileToFaceBase64(
  file: File,
  options: Partial<FaceEncodeOptions> = {},
): Promise<string> {
  const { maxBytes, maxDimension } = { ...DEFAULT_FACE_ENCODE, ...options };
  const allowedTypes = new Set(['image/jpeg', 'image/png']);
  if (!allowedTypes.has(file.type)) {
    throw new Error('Faqat JPG yoki PNG formatidagi rasm qabul qilinadi.');
  }
  if (file.size < 10 * 1024) {
    throw new Error('Rasm hajmi 10KB dan kichik bo‘lmasligi kerak.');
  }

  // Fast path: already small enough (roughly) -> send original.
  if (file.size <= maxBytes) {
    return fileToBase64(file);
  }

  const bmp = await fileToImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bmp.width || 1, bmp.height || 1));
  const targetW = Math.max(1, Math.round(bmp.width * scale));
  const targetH = Math.max(1, Math.round(bmp.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(bmp, 0, 0, targetW, targetH);

  // Try decreasing quality first. If still too big, downscale and retry.
  let quality = 0.9;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const blob = await canvasToJpegBlob(canvas, quality);
    if (blob.size <= maxBytes) {
      return blobToBase64(blob);
    }
    quality -= 0.1;
    if (quality < 0.4) break;
  }

  // Downscale loop.
  let downscale = 0.85;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const w = Math.max(1, Math.round(canvas.width * downscale));
    const h = Math.max(1, Math.round(canvas.height * downscale));
    const next = document.createElement('canvas');
    next.width = w;
    next.height = h;
    const nctx = next.getContext('2d');
    if (!nctx) throw new Error('Canvas not supported');
    nctx.drawImage(canvas, 0, 0, w, h);

    const blob = await canvasToJpegBlob(next, 0.75);
    if (blob.size <= maxBytes) {
      return blobToBase64(blob);
    }

    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(next, 0, 0);
    downscale *= 0.9;
  }

  throw new Error(
    `Face image is too large. Please use a smaller/cropped image (max ${Math.round(maxBytes / 1024)}KB).`,
  );
}

/**
 * Resizes a base64 image to fit under maxBytes (default 200KB).
 * Used for Excel import where images come as base64.
 */
export async function base64ToResizedBase64(
  base64: string,
  options: Partial<FaceEncodeOptions> = {},
): Promise<string> {
  const { maxBytes, maxDimension } = { ...DEFAULT_FACE_ENCODE, ...options };

  // Decode base64 to check size
  const binaryString = atob(base64);
  const currentBytes = binaryString.length;

  // If already small enough, return as-is
  if (currentBytes <= maxBytes) {
    return base64;
  }

  appLogger.debug(
    `[Resize] Image too large: ${Math.round(currentBytes / 1024)}KB, resizing to max ${Math.round(maxBytes / 1024)}KB`,
  );

  // Create image from base64
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = `data:image/jpeg;base64,${base64}`;
  });

  // Calculate scale
  const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
  const targetW = Math.max(1, Math.round(img.naturalWidth * scale));
  const targetH = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(img, 0, 0, targetW, targetH);

  // Try decreasing quality first
  let quality = 0.92;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const blob = await canvasToJpegBlob(canvas, quality);
    if (blob.size <= maxBytes) {
      appLogger.debug(`[Resize] Success at quality ${quality.toFixed(2)}: ${Math.round(blob.size / 1024)}KB`);
      return blobToBase64(blob);
    }
    quality -= 0.08;
    if (quality < 0.4) break;
  }

  // Downscale loop
  let downscale = 0.85;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const w = Math.max(1, Math.round(canvas.width * downscale));
    const h = Math.max(1, Math.round(canvas.height * downscale));
    const next = document.createElement('canvas');
    next.width = w;
    next.height = h;
    const nctx = next.getContext('2d');
    if (!nctx) throw new Error('Canvas not supported');
    nctx.drawImage(canvas, 0, 0, w, h);

    const blob = await canvasToJpegBlob(next, 0.8);
    if (blob.size <= maxBytes) {
      appLogger.debug(`[Resize] Success after downscale: ${Math.round(blob.size / 1024)}KB`);
      return blobToBase64(blob);
    }

    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(next, 0, 0);
    downscale *= 0.9;
  }

  throw new Error(`Image could not be resized to under ${Math.round(maxBytes / 1024)}KB`);
}
