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

    const { data, error } = await periodMembersRepository.remove(id);

    if (error) {
      if (error.code === "23503") {
        throw new Error(
          "Khong the xoa thanh vien nay khoi ky vi da co du lieu lien quan (cong no, chi phi cau...)."
        );
      }
      throw new Error(error.message);
    }

    return data;
  }
};