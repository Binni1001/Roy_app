import { periodMembersRepository } from "./periodMembers.repository.js";

const allowedStatuses = ["fixed", "guest", "inactive"];

export const periodMembersService = {
  async getMembersByPeriod(periodId) {
    if (!periodId) {
      throw new Error("Period ID khong duoc de trong");
    }

    const { data, error } = await periodMembersRepository.getByPeriodId(periodId);

    if (error) {
      throw new Error(error.message);
    }

    return data;
  },

  async getPeriodMemberById(id) {
    if (!id) {
      throw new Error("Period member ID khong duoc de trong");
    }

    const { data, error } = await periodMembersRepository.getById(id);

    if (error) {
      throw new Error(error.message);
    }

    return data;
  },

  async createPeriodMember(payload = {}) {
    if (!payload.period_id) {
      throw new Error("Period ID khong duoc de trong");
    }

    if (!payload.person_id) {
      throw new Error("Person ID khong duoc de trong");
    }

    // FIX #5: check period tồn tại và không phải closed/draft không cho thêm member
    const periodResult = await periodMembersRepository.getPeriodById(payload.period_id);
    if (periodResult.error) throw new Error(periodResult.error.message);
    const period = periodResult.data;
    if (period.status === "closed") {
      throw new Error("Ky nay da dong, khong the them thanh vien");
    }

    // FIX #3: check person phải active mới được enroll vào kỳ
    const personResult = await periodMembersRepository.getPersonById(payload.person_id);
    if (personResult.error) throw new Error(personResult.error.message);
    const person = personResult.data;
    if (person.status !== "active") {
      throw new Error("Chi co the them thanh vien dang hoat dong vao ky");
    }

    // FIX #3: dùng attendance_type của người đó làm default status nếu không truyền vào
    const status = payload.status || person.attendance_type || "guest";

    if (!allowedStatuses.includes(status)) {
      throw new Error("Status khong hop le. Chi duoc dung: fixed, guest, inactive");
    }

    const existing = await periodMembersRepository.findByPeriodAndPerson(
      payload.period_id,
      payload.person_id
    );

    if (existing.error) {
      throw new Error(existing.error.message);
    }

    if (existing.data) {
      throw new Error("Nguoi nay da ton tai trong ky nay");
    }

    const { data, error } = await periodMembersRepository.create({
      period_id: payload.period_id,
      person_id: payload.person_id,
      status,
      note: payload.note || null
    });

    if (error) {
      throw new Error(error.message);
    }

    if (status === "fixed") {
      // period đã được fetch ở trên (dùng lại biến period)
      const existingDebtResult = await periodMembersRepository.findAnyMonthlyDebt(
        payload.period_id,
        payload.person_id
      );

      if (existingDebtResult.error) {
        throw new Error(existingDebtResult.error.message);
      }

      if (existingDebtResult.data) {
        return {
          period_member: data,
          created_debt: null,
          debt_action: {
            action: "monthly_fee_debt_already_exists",
            debt: existingDebtResult.data
          }
        };
      }

      if (Number(period.fixed_member_fee) > 0) {
        const debtResult = await periodMembersRepository.createDebt({
          period_id: payload.period_id,
          person_id: payload.person_id,
          debt_type: "monthly_fee",
          amount: Number(period.fixed_member_fee),
          status: "unpaid",
          description: `Tien co dinh ${period.name}`
        });

        if (debtResult.error) {
          throw new Error(debtResult.error.message);
        }

        return {
          period_member: data,
          created_debt: debtResult.data
        };
      }
    }

    return {
      period_member: data,
      created_debt: null
    };
  },

  async createPeriodMembers(payload = {}) {
    if (!payload.period_id) {
      throw new Error("Period ID khong duoc de trong");
    }

    if (!Array.isArray(payload.person_ids) || payload.person_ids.length === 0) {
      throw new Error("Can chon it nhat mot nguoi");
    }

    const personIds = [...new Set(payload.person_ids.filter(Boolean))];
    if (personIds.length === 0) {
      throw new Error("Can chon it nhat mot nguoi");
    }
    if (personIds.length > 100) {
      throw new Error("Moi lan chi duoc them toi da 100 nguoi");
    }

    const periodResult = await periodMembersRepository.getPeriodById(payload.period_id);
    if (periodResult.error) throw new Error(periodResult.error.message);
    const period = periodResult.data;
    if (period.status === "closed") {
      throw new Error("Ky nay da dong, khong the them thanh vien");
    }

    const [peopleResult, existingMembersResult] = await Promise.all([
      periodMembersRepository.getPeopleByIds(personIds),
      periodMembersRepository.getExistingByPeriodAndPeople(payload.period_id, personIds)
    ]);
    if (peopleResult.error) throw new Error(peopleResult.error.message);
    if (existingMembersResult.error) throw new Error(existingMembersResult.error.message);

    const peopleById = new Map(peopleResult.data.map((person) => [person.id, person]));
    const existingPersonIds = new Set(existingMembersResult.data.map((member) => member.person_id));
    const skipped = [];
    const failed = [];
    const memberPayloads = [];

    for (const personId of personIds) {
      if (existingPersonIds.has(personId)) {
        skipped.push({ person_id: personId, reason: "Nguoi nay da ton tai trong ky nay" });
        continue;
      }

      const person = peopleById.get(personId);
      if (!person) {
        failed.push({ person_id: personId, reason: "Khong tim thay nguoi nay" });
        continue;
      }
      if (person.status !== "active") {
        failed.push({ person_id: personId, reason: "Chi co the them thanh vien dang hoat dong vao ky" });
        continue;
      }

      const status = person.attendance_type || "guest";
      if (!allowedStatuses.includes(status)) {
        failed.push({ person_id: personId, reason: "Hinh thuc choi khong hop le" });
        continue;
      }

      memberPayloads.push({ period_id: payload.period_id, person_id: personId, status, note: null });
    }

    if (memberPayloads.length === 0 && failed.length > 0) {
      throw new Error(failed[0].reason);
    }

    let createdMembers = [];
    if (memberPayloads.length > 0) {
      const createMembersResult = await periodMembersRepository.createMany(memberPayloads);
      if (createMembersResult.error) throw new Error(createMembersResult.error.message);
      createdMembers = createMembersResult.data;
    }

    const fixedPersonIds = memberPayloads
      .filter((member) => member.status === "fixed")
      .map((member) => member.person_id);
    let createdDebts = [];
    const existingDebtsByPerson = new Map();

    if (fixedPersonIds.length > 0) {
      const existingDebtsResult = await periodMembersRepository.getMonthlyDebtsByPeriodAndPeople(
        payload.period_id,
        fixedPersonIds
      );
      if (existingDebtsResult.error) throw new Error(existingDebtsResult.error.message);
      existingDebtsResult.data.forEach((debt) => existingDebtsByPerson.set(debt.person_id, debt));

      const debtPayloads = Number(period.fixed_member_fee) > 0
        ? fixedPersonIds
            .filter((personId) => !existingDebtsByPerson.has(personId))
            .map((personId) => ({
              period_id: payload.period_id,
              person_id: personId,
              debt_type: "monthly_fee",
              amount: Number(period.fixed_member_fee),
              status: "unpaid",
              description: `Tien co dinh ${period.name}`
            }))
        : [];

      if (debtPayloads.length > 0) {
        const createDebtsResult = await periodMembersRepository.createDebts(debtPayloads);
        if (createDebtsResult.error) throw new Error(createDebtsResult.error.message);
        createdDebts = createDebtsResult.data;
      }
    }

    const createdDebtsByPerson = new Map(createdDebts.map((debt) => [debt.person_id, debt]));
    const created = createdMembers.map((member) => ({
      period_member: member,
      created_debt: createdDebtsByPerson.get(member.person_id) || null,
      ...(existingDebtsByPerson.has(member.person_id)
        ? {
            debt_action: {
              action: "monthly_fee_debt_already_exists",
              debt: existingDebtsByPerson.get(member.person_id)
            }
          }
        : {})
    }));

    return {
      requested_count: personIds.length,
      created_count: created.length,
      skipped_count: skipped.length,
      failed_count: failed.length,
      created,
      skipped,
      failed
    };
  },

  async updatePeriodMember(id, payload = {}) {
    if (!id) {
      throw new Error("Period member ID khong duoc de trong");
    }

    const currentResult = await periodMembersRepository.getById(id);

    if (currentResult.error) {
      throw new Error(currentResult.error.message);
    }

    const currentMember = currentResult.data;

    const oldStatus = currentMember.status;
    const newStatus = payload.status ?? oldStatus;

    if (!allowedStatuses.includes(newStatus)) {
      throw new Error("Status khong hop le. Chi duoc dung: fixed, guest, inactive");
    }

    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (payload.status !== undefined) {
      updateData.status = newStatus;
    }

    if (payload.note !== undefined) {
      updateData.note = payload.note;
    }

    if (payload.exempt_shuttle !== undefined) {
      updateData.exempt_shuttle = Boolean(payload.exempt_shuttle);
    }

    const { data, error } = await periodMembersRepository.update(id, updateData);

    if (error) {
      throw new Error(error.message);
    }

    let debt_action = null;

    if (oldStatus !== newStatus) {
      const monthlyDebtResult = await periodMembersRepository.findMonthlyDebt(
        currentMember.period_id,
        currentMember.person_id
      );

      if (monthlyDebtResult.error) {
        throw new Error(monthlyDebtResult.error.message);
      }

      const monthlyDebt = monthlyDebtResult.data;

      if (oldStatus !== "fixed" && newStatus === "fixed") {
        if (!monthlyDebt) {
          const periodResult = await periodMembersRepository.getPeriodById(
            currentMember.period_id
          );

          if (periodResult.error) {
            throw new Error(periodResult.error.message);
          }

          const period = periodResult.data;

          if (Number(period.fixed_member_fee) > 0) {
            const debtResult = await periodMembersRepository.createDebt({
              period_id: currentMember.period_id,
              person_id: currentMember.person_id,
              debt_type: "monthly_fee",
              amount: Number(period.fixed_member_fee),
              status: "unpaid",
              description: `Tien co dinh ${period.name}`
            });

            if (debtResult.error) {
              throw new Error(debtResult.error.message);
            }

            debt_action = {
              action: "created_monthly_fee_debt",
              debt: debtResult.data
            };
          }
        }
      }

      if (oldStatus === "fixed" && newStatus !== "fixed") {
        if (monthlyDebt) {
          if (monthlyDebt.status === "unpaid") {
            const cancelResult = await periodMembersRepository.cancelDebt(
              monthlyDebt.id
            );

            if (cancelResult.error) {
              throw new Error(cancelResult.error.message);
            }

            debt_action = {
              action: "cancelled_unpaid_monthly_fee_debt",
              debt: cancelResult.data
            };
          }

          if (monthlyDebt.status === "paid") {
            debt_action = {
              action: "monthly_fee_already_paid_need_balance_or_refund_later",
              debt: monthlyDebt
            };
          }
        }
      }
    }

    return {
      period_member: data,
      debt_action
    };
  },

  async deletePeriodMember(id) {
    if (!id) {
      throw new Error("Period member ID khong duoc de trong");
    }

    // Huỷ nợ tháng chưa trả của người này trong kỳ (nếu có) trước khi xoá,
    // tránh để nợ "mồ côi" còn treo sau khi đã rời kỳ.
    let debt_action = null;
    const memberResult = await periodMembersRepository.getById(id);
    const member = memberResult?.data;
    if (member) {
      const personId = member.person_id || member.person?.id;
      const periodId = member.period_id || member.period?.id;
      if (personId && periodId) {
        const debtResult = await periodMembersRepository.findMonthlyDebt(periodId, personId);
        const debt = debtResult?.data;
        if (debt && debt.status === "unpaid") {
          const cancelResult = await periodMembersRepository.cancelDebt(debt.id);
          if (cancelResult.error) throw new Error(cancelResult.error.message);
          debt_action = { action: "cancelled_unpaid_monthly_fee_debt", debt: cancelResult.data };
        }
      }
    }

    const { data, error } = await periodMembersRepository.remove(id);

    if (error) {
      if (error.code === "23503") {
        throw new Error(
          "Khong the xoa thanh vien nay khoi ky vi da co du lieu lien quan (cong no, chi phi cau...)."
        );
      }
      throw new Error(error.message);
    }

    return { ...data, debt_action };
  }
};
