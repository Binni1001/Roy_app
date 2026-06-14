/**
 * Tập hợp các hàm validation dùng chung cho toàn backend.
 * Mỗi hàm trả về { valid: boolean, message: string }
 */

// ─── SỐ ĐIỆN THOẠI ────────────────────────────────────────────────────────────
// Quy tắc: đúng 10 chữ số, bắt đầu bằng 0, prefix hợp lệ của VN
const VN_PHONE_REGEX = /^(0[3|5|7|8|9])\d{8}$/;

export function validatePhone(phone) {
  if (!phone) return { valid: true }; // phone là optional

  const cleaned = phone.replace(/\s|-/g, "");

  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, message: "So dien thoai chi duoc chua chu so" };
  }

  if (cleaned.length !== 10) {
    return { valid: false, message: "So dien thoai phai co dung 10 chu so" };
  }

  if (!VN_PHONE_REGEX.test(cleaned)) {
    return {
      valid: false,
      message: "So dien thoai khong hop le (phai bat dau bang 03, 05, 07, 08 hoac 09)"
    };
  }

  return { valid: true };
}

// ─── EMAIL ────────────────────────────────────────────────────────────────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email) {
  if (!email) return { valid: true }; // email là optional trừ khi bắt buộc

  const trimmed = email.trim();

  if (trimmed.length > 254) {
    return { valid: false, message: "Email qua dai (toi da 254 ky tu)" };
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, message: "Email khong dung dinh dang (vi du: abc@gmail.com)" };
  }

  return { valid: true };
}

export function requireEmail(email) {
  if (!email || !email.trim()) {
    return { valid: false, message: "Email khong duoc de trong" };
  }
  return validateEmail(email);
}

// ─── MẬT KHẨU ─────────────────────────────────────────────────────────────────
// Dùng khi backend cần validate password (ví dụ: admin set password thủ công)
// Supabase Auth xử lý auth flow, nhưng khi admin tạo user thủ công cần enforce
export function validatePassword(password) {
  if (!password) {
    return { valid: false, message: "Mat khau khong duoc de trong" };
  }

  if (password.length < 8) {
    return { valid: false, message: "Mat khau phai co it nhat 8 ky tu" };
  }

  if (password.length > 128) {
    return { valid: false, message: "Mat khau qua dai (toi da 128 ky tu)" };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Mat khau phai co it nhat 1 chu in hoa" };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "Mat khau phai co it nhat 1 chu thuong" };
  }

  if (!/\d/.test(password)) {
    return { valid: false, message: "Mat khau phai co it nhat 1 chu so" };
  }

  return { valid: true };
}

// ─── HỌ TÊN ──────────────────────────────────────────────────────────────────
export function validateFullName(name) {
  if (!name || !name.trim()) {
    return { valid: false, message: "Ho ten khong duoc de trong" };
  }

  const trimmed = name.trim();

  if (trimmed.length < 2) {
    return { valid: false, message: "Ho ten phai co it nhat 2 ky tu" };
  }

  if (trimmed.length > 100) {
    return { valid: false, message: "Ho ten qua dai (toi da 100 ky tu)" };
  }

  // Không cho phép ký tự đặc biệt nguy hiểm
  if (/[<>\"'%;()&+]/.test(trimmed)) {
    return { valid: false, message: "Ho ten chua ky tu khong hop le" };
  }

  return { valid: true };
}

// ─── NICKNAME ──────────────────────────────────────────────────────────────────
export function validateNickname(nickname) {
  if (!nickname) return { valid: true }; // optional

  const trimmed = nickname.trim();

  if (trimmed.length > 50) {
    return { valid: false, message: "Nickname qua dai (toi da 50 ky tu)" };
  }

  if (/[<>\"'%;()&+]/.test(trimmed)) {
    return { valid: false, message: "Nickname chua ky tu khong hop le" };
  }

  return { valid: true };
}

// ─── NGÀY THÁNG ──────────────────────────────────────────────────────────────
export function validateDate(dateStr, fieldName = "Ngay") {
  if (!dateStr) return { valid: true }; // optional

  const parsed = new Date(dateStr);

  if (isNaN(parsed.getTime())) {
    return { valid: false, message: `${fieldName} khong dung dinh dang (YYYY-MM-DD)` };
  }

  // Không cho phép ngày quá xa trong tương lai (10 năm)
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 10);

  if (parsed > maxDate) {
    return { valid: false, message: `${fieldName} khong duoc qua 10 nam trong tuong lai` };
  }

  // Không cho phép ngày quá xa trong quá khứ (100 năm)
  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 100);

  if (parsed < minDate) {
    return { valid: false, message: `${fieldName} khong hop le (qua xa trong qua khu)` };
  }

  return { valid: true };
}

export function requireDate(dateStr, fieldName = "Ngay") {
  if (!dateStr) {
    return { valid: false, message: `${fieldName} khong duoc de trong` };
  }
  return validateDate(dateStr, fieldName);
}

// Ngày không được ở tương lai (dùng cho play_date, buy_date)
export function validateDateNotFuture(dateStr, fieldName = "Ngay") {
  if (!dateStr) return { valid: true };

  const result = validateDate(dateStr, fieldName);
  if (!result.valid) return result;

  const parsed = new Date(dateStr);
  const today = new Date();
  today.setHours(23, 59, 59, 999); // cuối ngày hôm nay

  if (parsed > today) {
    return { valid: false, message: `${fieldName} khong duoc o tuong lai` };
  }

  return { valid: true };
}

// ─── SỐ TIỀN ─────────────────────────────────────────────────────────────────
export function validateAmount(amount, fieldName = "So tien", allowZero = false) {
  const num = Number(amount);

  if (isNaN(num)) {
    return { valid: false, message: `${fieldName} phai la so` };
  }

  if (allowZero ? num < 0 : num <= 0) {
    const msg = allowZero
      ? `${fieldName} khong duoc am`
      : `${fieldName} phai lon hon 0`;
    return { valid: false, message: msg };
  }

  // Tối đa 10 tỷ VND
  if (num > 10_000_000_000) {
    return { valid: false, message: `${fieldName} qua lon (toi da 10 ty)` };
  }

  return { valid: true };
}

// ─── TEXT CHUNG ───────────────────────────────────────────────────────────────
export function validateText(value, fieldName = "Truong nay", maxLength = 500) {
  if (!value) return { valid: true }; // optional

  if (typeof value !== "string") {
    return { valid: false, message: `${fieldName} phai la chuoi ky tu` };
  }

  if (value.length > maxLength) {
    return {
      valid: false,
      message: `${fieldName} qua dai (toi da ${maxLength} ky tu)`
    };
  }

  return { valid: true };
}

// ─── HELPER: throw nếu không valid ────────────────────────────────────────────
export function assertValid(result) {
  if (!result.valid) {
    throw new Error(result.message);
  }
}
