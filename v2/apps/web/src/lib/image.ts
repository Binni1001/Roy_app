/** Cạnh ảnh đại diện sau khi thu nhỏ. Ảnh hiện tối đa 60 px, 512 px đủ nét trên màn hình mật độ cao. */
const SIZE = 512;

function encode(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, 0.85));
}

/**
 * Cắt ảnh thành hình vuông ở giữa, thu về 512 px và nén WebP (trình duyệt không hỗ trợ thì JPEG).
 * Ảnh chụp điện thoại vài MB còn khoảng 30–80 KB trước khi gửi lên.
 */
export async function squareAvatar(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Chọn một file ảnh.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Không đọc được ảnh này. Thử ảnh JPG hoặc PNG khác.");
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(SIZE, side);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Trình duyệt không xử lý được ảnh.");
  context.imageSmoothingQuality = "high";
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  bitmap.close();
  const webp = await encode(canvas, "image/webp");
  if (webp?.type === "image/webp") return webp;
  const jpeg = await encode(canvas, "image/jpeg");
  if (!jpeg) throw new Error("Không nén được ảnh.");
  return jpeg;
}
