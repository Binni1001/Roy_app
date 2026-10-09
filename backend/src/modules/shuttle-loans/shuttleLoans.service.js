import { shuttleLoansRepository as repo } from "./shuttleLoans.repository.js";
import { periodsService } from "../periods/periods.service.js";
import { groupAccess } from "../../services/groupAccess.js";
import { requireDate, validateText, assertValid } from "../../utils/validators.js";

function result({ data, error }) {
  if (error) throw new Error(error.code === "PGRST202" || error.code === "42P01"
    ? "Cần chạy migration 20261006_shuttle_closeout_and_loans.sql trước khi sử dụng."
    : error.message);
  return data;
}

export const shuttleLoansService = {
  async candidates(periodId, user) {
    const period = await periodsService.getAccessiblePeriod(periodId, user);
    return result(await repo.candidates(period.group_id)).map((row) => row.person);
  },
  async byPeriod(periodId, user) {
    await periodsService.getAccessiblePeriod(periodId, user);
    return result(await repo.byPeriod(periodId));
  },
  async mine(user) {
    const person = result(await repo.personByEmail(user?.email?.trim().toLowerCase() || ""));
    if (!person || person.status !== "active") return [];
    const groups = await groupAccess.visibleGroupIds(user);
    const loans = result(await repo.byPerson(person.id));
    return loans.filter((loan) => groups === null || groups.includes(loan.period?.group_id));
  },
  async create(payload, user) {
    await periodsService.getAccessiblePeriod(payload.period_id, user, true);
    if (!payload.person_id) throw new Error("Vui lòng chọn người đại diện trả tiền.");
    for (const [field, label] of [["quantity", "Số quả"], ["unit_price", "Giá mỗi quả"]]) {
      if (!Number.isSafeInteger(Number(payload[field])) || Number(payload[field]) <= 0) {
        throw new Error(`${label} phải là số nguyên lớn hơn 0.`);
      }
    }
    if (!Number.isSafeInteger(Number(payload.quantity) * Number(payload.unit_price))) throw new Error("Tổng tiền quá lớn.");
    assertValid(requireDate(payload.borrowed_at, "Ngày mượn"));
    // The RPC checks future dates using the club's Asia/Ho_Chi_Minh calendar.
    assertValid(validateText(payload.note, "Ghi chú", 500));
    return result(await repo.create({ ...payload, quantity: Number(payload.quantity), unit_price: Number(payload.unit_price) }));
  },
  async change(id, user, action) {
    const loan = result(await repo.byId(id));
    if (!loan) throw new Error("Không tìm thấy khoản mượn.");
    await periodsService.getAccessiblePeriod(loan.period_id, user, true);
    return result(await repo[action](id));
  },
};
