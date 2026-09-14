import { getUserRole } from "./roles.js";

// Match the application's trusted Auth role. Never infer a role
// from a person's display name or expose Auth metadata to the browser.
export function createActivityEligibility(listUsers) {
  return async function annotatePeople(people = []) {
    if (!people.length) return [];
    const roles = new Map();
    const perPage = 100;
    for (let page = 1; ; page += 1) {
      const { data, error } = await listUsers({ page, perPage });
      if (error) throw new Error("Không thể kiểm tra vai trò tài khoản: " + error.message);
      const users = data?.users;
      if (!Array.isArray(users)) throw new Error("Không thể kiểm tra vai trò tài khoản");
      for (const user of users) {
        if (user.email) roles.set(user.email.trim().toLowerCase(),
          getUserRole(user));
      }
      if (users.length < perPage) break;
    }
    return people.map((person) => {
      const accountRole = roles.get(person.email?.trim().toLowerCase()) || "user";
      return { ...person, account_role: accountRole,
        activity_eligible: person.status === "active" && accountRole === "user" };
    });
  };
}
