import { adminUsersService } from "./adminUsers.service.js";

function handleError(error, res) {
  res.status(error.statusCode || 500).json({
    message: error.message || "Admin user request failed"
  });
}

export const adminUsersController = {
  async groups(req, res) {
    try { res.json(await adminUsersService.listGroups()); }
    catch (error) { handleError(error, res); }
  },

  async assignGroups(req, res) {
    try { res.json(await adminUsersService.assignGroups(req.params.id, req.body.group_ids)); }
    catch (error) { handleError(error, res); }
  },

  async list(req, res) {
    try {
      const users = await adminUsersService.listAdmins();
      res.json(users);
    } catch (error) {
      handleError(error, res);
    }
  },

  async invite(req, res) {
    try {
      const result = await adminUsersService.inviteAdmin(req.body);
      res.status(result.invited ? 201 : 200).json(result);
    } catch (error) {
      handleError(error, res);
    }
  },

  async revoke(req, res) {
    try {
      const result = await adminUsersService.revokeAdmin(req.params.id);
      res.json(result);
    } catch (error) {
      handleError(error, res);
    }
  }
};
