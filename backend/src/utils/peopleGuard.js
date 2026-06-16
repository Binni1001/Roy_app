import { supabase } from "../config/supabase.js";

// Chan khong cho dung nguoi da nghi (status != "active") vao bat ky hoat dong
// nao tren web (ky sinh hoat, kèo PK, chi phi cau, cong no, so quy, buoi danh...).
export async function assertPeopleActive(personIds = []) {
  const ids = [...new Set((personIds || []).filter(Boolean))];
  if (ids.length === 0) return;

  const { data, error } = await supabase
    .from("people")
    .select("id, full_name, status")
    .in("id", ids);

  if (error) throw new Error(error.message);

  const found = data || [];
  const foundIds = new Set(found.map((p) => p.id));
  const missing = ids.filter((id) => !foundIds.has(id));

  if (missing.length > 0) {
    throw new Error("Khong tim thay nguoi choi tuong ung");
  }

  const inactive = found.filter((p) => p.status !== "active");

  if (inactive.length > 0) {
    const names = inactive.map((p) => p.full_name).join(", ");
    throw new Error(`Khong the thuc hien: nguoi sau da nghi va khong the them vao hoat dong: ${names}`);
  }
}
