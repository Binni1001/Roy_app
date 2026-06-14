import { guestAttendancesRepository } from "./guestAttendances.repository.js";
import { validateAmount, validateText, assertValid } from "../../utils/validators.js";

function buildGuestDebtDescription(session, attendanceId) {
  const periodName = session.period?.name || "ky";
  return `Tien khach vang lai ${periodName} ngay ${session.play_date} [guest_attendance:${attendanceId}]`;
}

export const guestAttendancesService = {
  async getAll() {
    const { data, error } = await guestAttendancesRepository.getAll();
    if (error) throw new Error(error.message);
    return data;
  },

  async getBySession(sessionId) {
    if (!sessionId) throw new Error("Session ID khong duoc de trong");

    const { data, error } =
      await guestAttendancesRepository.getBySessionId(sessionId);

    if (error) throw new Error(error.message);
    return data;
  },

  async getByPerson(personId) {
    if (!personId) throw new Error("Person ID khong duoc de trong");

    const { data, error } =
      await guestAttendancesRepository.getByPersonId(personId);

    if (error) throw new Error(error.message);
    return data;
  },

  async getById(id) {
    if (!id) throw new Error("Guest attendance ID khong duoc de trong");

    const { data, error } = await guestAttendancesRepository.getById(id);
    if (error) throw new Error(error.message);
    return data;
  },

  async create(payload = {}) {
    if (!payload.session_id) throw new Error("Session ID khong duoc de trong");
    if (!payload.person_id) throw new Error("Person ID khong duoc de trong");

    const sessionResult = await guestAttendancesRepository.getSession(
      payload.session_id
    );

    if (sessionResult.error) throw new Error(sessionResult.error.message);

    const session = sessionResult.data;

    const existingResult =
      await guestAttendancesRepository.findBySessionAndPerson(
        payload.session_id,
        payload.person_id
      );

    if (existingResult.error) throw new Error(existingResult.error.message);

    if (existingResult.data) {
      throw new Error("Nguoi nay da co trong buoi danh nay");
    }

    const amount =
      payload.amount !== undefined
        ? Number(payload.amount)
        : Number(session.period?.guest_fee_per_session || 0);

    // Validate amount (cho phép 0 = khách được mời miễn phí)
    assertValid(validateAmount(amount, "Tien khach vang lai", true));
    assertValid(validateText(payload.note, "Ghi chu", 500));

    const attendanceResult = await guestAttendancesRepository.create({
      session_id: payload.session_id,
      person_id: payload.person_id,
      amount,
      note: payload.note || null
    });

    if (attendanceResult.error) {
      throw new Error(attendanceResult.error.message);
    }

    let createdDebt = null;

    if (amount > 0) {
      // FIX #2: lưu source_attendance_id để link FK thật, không dùng string lookup nữa
      const debtResult = await guestAttendancesRepository.createDebt({
        period_id: session.period_id,
        person_id: payload.person_id,
        debt_type: "guest_fee",
        amount,
        status: "unpaid",
        source_attendance_id: attendanceResult.data.id,
        description: buildGuestDebtDescription(session, attendanceResult.data.id)
      });

      if (debtResult.error) {
        throw new Error(debtResult.error.message);
      }

      createdDebt = debtResult.data;
    }

    return {
      guest_attendance: attendanceResult.data,
      created_debt: createdDebt
    };
  },

  async update(id, payload = {}) {
    if (!id) throw new Error("Guest attendance ID khong duoc de trong");

    const currentResult = await guestAttendancesRepository.getById(id);
    if (currentResult.error) throw new Error(currentResult.error.message);

    const current = currentResult.data;

    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (payload.amount !== undefined) {
      assertValid(validateAmount(payload.amount, "Tien khach vang lai", true));
      updateData.amount = Number(payload.amount);
    }

    if (payload.note !== undefined) {
      assertValid(validateText(payload.note, "Ghi chu", 500));
      updateData.note = payload.note;
    }

    const { data, error } = await guestAttendancesRepository.update(id, updateData);

    if (error) throw new Error(error.message);

    let debtAction = null;

    if (
      payload.amount !== undefined &&
      Number(payload.amount) !== Number(current.amount)
    ) {
      const session = current.session;
      let cancelledDebt = null;
      let createdDebt = null;

      if (Number(current.amount) > 0 && session) {
        const oldDebtResult = await guestAttendancesRepository.findGuestDebt(
          session.period_id,
          current.person_id,
          current.id
        );

        if (oldDebtResult.error) throw new Error(oldDebtResult.error.message);

        if (oldDebtResult.data) {
          const cancelResult = await guestAttendancesRepository.cancelDebt(
            oldDebtResult.data.id
          );

          if (cancelResult.error) throw new Error(cancelResult.error.message);
          cancelledDebt = cancelResult.data;
        }
      }

      if (Number(payload.amount) > 0 && session) {
        const debtResult = await guestAttendancesRepository.createDebt({
          period_id: session.period_id,
          person_id: current.person_id,
          debt_type: "guest_fee",
          amount: Number(payload.amount),
          status: "unpaid",
          source_attendance_id: current.id,
          description: buildGuestDebtDescription(session, current.id)
        });

        if (debtResult.error) throw new Error(debtResult.error.message);
        createdDebt = debtResult.data;
      }

      debtAction = {
        action: "recreated_guest_fee_debt",
        old_amount: Number(current.amount),
        new_amount: Number(payload.amount),
        cancelled_debt: cancelledDebt,
        created_debt: createdDebt
      };
    }

    return {
      guest_attendance: data,
      debt_action: debtAction
    };
  },

  async remove(id) {
    if (!id) throw new Error("Guest attendance ID khong duoc de trong");

    const currentResult = await guestAttendancesRepository.getById(id);
    if (currentResult.error) throw new Error(currentResult.error.message);

    const current = currentResult.data;
    const session = current.session;
    let cancelledDebt = null;

    if (Number(current.amount) > 0 && session) {
      const debtResult = await guestAttendancesRepository.findGuestDebt(
        session.period_id,
        current.person_id,
        current.id
      );

      if (debtResult.error) throw new Error(debtResult.error.message);

      if (debtResult.data) {
        const cancelResult = await guestAttendancesRepository.cancelDebt(
          debtResult.data.id
        );

        if (cancelResult.error) throw new Error(cancelResult.error.message);
        cancelledDebt = cancelResult.data;
      }
    }

    const { data, error } = await guestAttendancesRepository.remove(id);
    if (error) throw new Error(error.message);

    return {
      guest_attendance: data,
      cancelled_debt: cancelledDebt
    };
  }
};
