import { periodMembersRepository } from "./periodMembers.repository.js";

const allowedStatuses = ["fixed", "guest", "inactive"];

export const periodMembersService = {
  async getMembersByPeriod(periodId) {
    if (!periodId) {
      throw new Error("Period ID không được để trống");
    }

    const { data, error } = await periodMembersRepository.getByPeriodId(periodId);

    if (error) {
      throw new Error(error.message);
    }

    return data;
  },

  async getPeriodMemberById(id) {
    if (!id) {
      throw new Error("Period member ID không được để trống");
    }

    const { data, error } = await periodMembersRepository.getById(id);

    if (error) {
      throw new Error(error.message);
    }

    return data;
  },

  async createPeriodMember(payload = {}) {
    if (!payload.period_id) {
      throw new Error("Period ID không được để trống");
    }

    if (!payload.person_id) {
      throw new Error("Person ID không được để trống");
    }

    const status = payload.status || "fixed";

    if (!allowedStatuses.includes(status)) {
      throw new Error("Status không hợp lệ. Chỉ được dùng: fixed, guest, inactive");
    }

    const existing = await periodMembersRepository.findByPeriodAndPerson(
      payload.period_id,
      payload.person_id
    );

    if (existing.error) {
      throw new Error(existing.error.message);
    }

    if (existing.data) {
      throw new Error("Người này đã tồn tại trong kỳ này");
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
      const periodResult = await periodMembersRepository.getPeriodById(payload.period_id);

      if (periodResult.error) {
        throw new Error(periodResult.error.message);
      }

      const period = periodResult.data;

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
          description: `Tiền cố định ${period.name}`
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
      throw new Error("Period member ID không được để trống");
    }

    const currentResult = await periodMembersRepository.getById(id);

    if (currentResult.error) {
      throw new Error(currentResult.error.message);
    }

    const currentMember = currentResult.data;

    const oldStatus = currentMember.status;
    const newStatus = payload.status ?? oldStatus;

    if (!allowedStatuses.includes(newStatus)) {
      throw new Error("Status không hợp lệ. Chỉ được dùng: fixed, guest, inactive");
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
              description: `Tiền cố định ${period.name}`
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
  }
};