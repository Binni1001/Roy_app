import { shuttleSettlementsRepository } from "./shuttleSettlements.repository.js";

function isMissingRpc(error) {
  return error?.code === "PGRST202" || /function .* does not exist/i.test(error?.message || "");
}

export const shuttleSettlementsService = {
  async preview(periodId) {
    if (!periodId) throw new Error("Thiếu kỳ chia cầu");
    const { data, error } = await shuttleSettlementsRepository.previewPeriod(periodId);
    if (error) throw new Error(isMissingRpc(error)
      ? "Cần chạy migration 20260913_shuttle_discount_percent.sql trước khi chia cầu."
      : error.message);
    if (!data?.settled && typeof data?.can_settle !== "boolean") {
      throw new Error("Cần chạy migration 20261006_shuttle_closeout_and_loans.sql trước khi chia cầu.");
    }
    return data;
  },

  async applyFund(periodId, payload) {
    const amount = Number(payload.amount);
    if (!payload.buyer_id || !Number.isSafeInteger(amount) || amount <= 0) {
      throw new Error("Chọn người mua và số tiền nguyên lớn hơn 0.");
    }
    const { data, error } = await shuttleSettlementsRepository.applyFund(periodId, payload.buyer_id, amount);
    if (error) throw new Error(isMissingRpc(error)
      ? "Cần chạy migration 20261006_shuttle_closeout_and_loans.sql trước khi dùng quỹ dư." : error.message);
    return data;
  },

  async settle(periodId) {
    if (!periodId) {
      throw new Error("Period ID khong duoc de trong");
    }

    // Require the percentage migration even if an older settlement RPC still exists.
    const preview = await this.preview(periodId);
    if (preview.settled) throw new Error("Kỳ này đã chốt chia cầu.");
    if (!preview.can_settle) throw new Error("Cần thu hết công nợ và tiền mượn cầu, đưa quỹ về 0 trước khi chia cầu.");
    // RPC performs the final calculation and writes atomically under the period lock.
    const rpcResult = await shuttleSettlementsRepository.settlePeriod(periodId);

    if (!rpcResult.error) {
      // Gửi notification cho từng thành viên sau khi chốt
      const rpcData = rpcResult.data || {};
      const details = rpcData.preview_details || [];
      if (details.length > 0) {
        const periodInfo = await shuttleSettlementsRepository.getPeriodById(periodId);
        const periodName = periodInfo.data?.name || "kỳ này";
        const resultsByPerson = new Map(
          (rpcData.results || []).map((result) => [result.person_id, result])
        );
        const notifications = details.map((detail) => {
          const result = resultsByPerson.get(detail.person_id) || {};
          const credited = Math.max(0, Number(detail.net_amount || 0));
          const offset = Number(result.offset?.offset_amount || 0);
          const remaining = Number(result.offset?.remaining_balance ?? credited);
          let body;

          if (detail.net_amount > 0 && offset > 0) {
            body = `Bạn được cộng ${credited.toLocaleString("vi-VN")}đ; `
              + `${offset.toLocaleString("vi-VN")}đ đã tự bù công nợ. `
              + `Số dư còn lại ${remaining.toLocaleString("vi-VN")}đ.`;
          } else if (detail.net_amount > 0) {
            body = `Bạn được cộng ${credited.toLocaleString("vi-VN")}đ do đã mua cầu nhiều hơn phần chịu.`;
          } else if (detail.net_amount < 0 && result.action === "paid_by_balance") {
            body = `Khoản tiền cầu ${Math.abs(detail.net_amount).toLocaleString("vi-VN")}đ đã được thanh toán bằng số dư của bạn.`;
          } else if (detail.net_amount < 0 && result.action === "partially_paid_by_balance") {
            body = `Số dư đã tự bù một phần tiền cầu; bạn còn cần nộp ${Number(result.remaining_amount || 0).toLocaleString("vi-VN")}đ.`;
          } else if (detail.net_amount < 0) {
            body = `Bạn cần nộp thêm ${Math.abs(detail.net_amount).toLocaleString("vi-VN")}đ tiền cầu kỳ này.`;
          } else {
            body = "Tiền cầu của bạn đã huề, không cần nộp thêm.";
          }

          return {
            person_id: detail.person_id,
            kind: "shuttle_settled",
            icon: detail.net_amount > 0 ? "💰" : detail.net_amount < 0 ? "⚠️" : "✅",
            title: `Chốt tiền cầu — ${periodName}`,
            body,
            action: "home",
          };
        });
        await shuttleSettlementsRepository.createNotifications(notifications).catch(() => {});
      }
      return rpcResult.data;
    }

    throw new Error(isMissingRpc(rpcResult.error)
      ? "Cần chạy migration chia cầu trước khi chốt."
      : rpcResult.error.message);
  }
};
