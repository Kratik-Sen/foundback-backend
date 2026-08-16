import AdminLog from '../models/AdminLog.js';

export function writeAdminLog(req, action, targetType, targetId, details = {}) {
  return AdminLog.create({
    admin: req.user._id,
    action,
    targetType,
    targetId,
    details,
    ipAddress: req.ip,
  });
}
