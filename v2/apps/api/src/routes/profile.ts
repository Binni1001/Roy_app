import type { Profile, ProfileInput } from "@roy/shared";

export interface ProfileStore {
  getProfile(personId: string): Promise<Profile | null>;
  updateProfile(personId: string, input: ProfileInput): Promise<Profile>;
}

export class ValidationError extends Error {}

function clean(value: unknown, label: string, max: number): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new ValidationError(`${label} không hợp lệ.`);
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length > max) throw new ValidationError(`${label} dài tối đa ${max} ký tự.`);
  return text || null;
}

/**
 * Thành viên chỉ tự sửa được thông tin hiển thị. Email, trạng thái, loại cố định hay vãng lai
 * và nhóm không đi qua đường này, vì chúng ảnh hưởng tới quyền và công nợ.
 */
export function parseProfileInput(body: unknown): ProfileInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ValidationError("Dữ liệu gửi lên không hợp lệ.");
  }
  const raw = body as Record<string, unknown>;

  const fullName = clean(raw.fullName, "Họ tên", 80);
  if (!fullName || fullName.length < 2) throw new ValidationError("Nhập họ tên, ít nhất 2 ký tự.");

  const phone = clean(raw.phone, "Số điện thoại", 20);
  if (phone && !/^\+?\d{9,12}$/.test(phone.replace(/[\s.-]/g, ""))) {
    throw new ValidationError("Số điện thoại gồm 9 đến 12 chữ số.");
  }

  return {
    fullName,
    nickname: clean(raw.nickname, "Biệt danh", 30),
    phone: phone ? phone.replace(/[\s.-]/g, "") : null,
    bio: clean(raw.bio, "Giới thiệu", 300),
  };
}
