import { peopleService } from "../modules/people/people.service.js";
import { periodsService } from "../modules/periods/periods.service.js";
import { badmintonSessionsService } from "../modules/badminton-sessions/badmintonSessions.service.js";

// Run before cached write replay: membership/assignment changes must be checked
// even when a browser retries an already completed idempotency key.
export async function adminResourceScope(req, res, next) {
  if (req.authRole !== "admin" || !["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  const [module, encodedId] = req.path.split("/").filter(Boolean);
  try {
    const id = encodedId ? decodeURIComponent(encodedId) : null;
    if (module?.toLowerCase() === "people" && id && id.toLowerCase() !== "me") {
      await peopleService.assertManagedPerson(req.authUser, id, true);
    }
    if (module?.toLowerCase() === "periods" && id) {
      await periodsService.getAccessiblePeriod(id, req.authUser, true);
    }
    if (module?.toLowerCase() === "badminton-sessions") {
      if (id) await badmintonSessionsService.getById(id, req.authUser, true);
      else await periodsService.getAccessiblePeriod(req.body?.period_id, req.authUser, true);
    }
    next();
  } catch (error) {
    res.status(error.statusCode || 400).json({ code: "GROUP_ACCESS_DENIED", message: error.message });
  }
}
