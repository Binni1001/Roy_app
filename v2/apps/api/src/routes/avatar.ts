import { ActionError } from "./actions.ts";

/** Ảnh đại diện tối đa 2 MB, giống giới hạn của bucket avatars. Web đã thu nhỏ ảnh trước khi gửi. */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export type AvatarType = "image/webp" | "image/jpeg" | "image/png";

export interface AvatarStore {
  /** Lưu ảnh vào bucket avatars và trả địa chỉ công khai (đã kèm tham số chống cache). */
  uploadAvatar(personId: string, bytes: Uint8Array, type: AvatarType): Promise<string>;
  setAvatarUrl(personId: string, url: string): Promise<void>;
}

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((value, index) => bytes[offset + index] === value);

/** Xác định loại ảnh theo nội dung file, không tin vào tên hay Content-Type người gửi khai. */
export function sniffImage(bytes: Uint8Array): AvatarType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // RIFF....WEBP
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

export function parseAvatar(bytes: Uint8Array): { bytes: Uint8Array; type: AvatarType } {
  if (bytes.length === 0) throw new ActionError("Chưa chọn ảnh.", 400, "AVATAR_EMPTY");
  if (bytes.length > MAX_AVATAR_BYTES) throw new ActionError("Ảnh lớn hơn 2 MB.", 413, "AVATAR_TOO_LARGE");
  const type = sniffImage(bytes);
  if (!type) throw new ActionError("Chỉ nhận ảnh JPG, PNG hoặc WebP.", 415, "AVATAR_TYPE");
  return { bytes, type };
}
