import { shuttleLoansService as service } from "./shuttleLoans.service.js";

function handler(action) {
  return async (req, res) => {
    try { res.json(await action(req)); }
    catch (error) { res.status(error.statusCode || 400).json({ message: error.message }); }
  };
}
export const shuttleLoansController = {
  candidates: handler((req) => service.candidates(req.params.periodId, req.authUser)),
  byPeriod: handler((req) => service.byPeriod(req.params.periodId, req.authUser)),
  mine: handler((req) => service.mine(req.authUser)),
  create: handler((req) => service.create(req.body, req.authUser)),
  repay: handler((req) => service.change(req.params.id, req.authUser, "repay")),
  cancel: handler((req) => service.change(req.params.id, req.authUser, "cancel")),
};
