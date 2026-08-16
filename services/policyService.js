const terminalStatuses = new Set(['returned', 'closed', 'expired', 'rejected']);

export function canEditItem(item, user) {
  const owns = String(item.reporter?._id || item.reporter) === String(user._id);
  return (owns || ['admin', 'staff'].includes(user.role)) && !terminalStatuses.has(item.status);
}

export function canAcceptClaim(item, user, approvedClaimExists = false) {
  if (!item || item.reportType !== 'found' || item.approvalStatus !== 'approved') return false;
  if (String(item.reporter?._id || item.reporter) === String(user._id)) return false;
  if (approvedClaimExists || terminalStatuses.has(item.status) || ['claim_approved', 'handover_scheduled'].includes(item.status)) return false;
  return true;
}

export function isPubliclyVisible(item, now = new Date()) {
  return item.approvalStatus === 'approved'
    && new Date(item.expiryDate) > now
    && !terminalStatuses.has(item.status)
    && item.status !== 'pending_approval';
}
