import Bookmark from '../models/Bookmark.js';
import Claim from '../models/Claim.js';
import Item from '../models/Item.js';
import Match from '../models/Match.js';
import Notification from '../models/Notification.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const studentDashboard = asyncHandler(async (req, res) => {
  const own = await Item.find({ reporter: req.user._id }).select('_id reportType status createdAt title images').sort({ createdAt: -1 });
  const ids = own.map((item) => item._id);
  const [possibleMatches, pendingClaims, recovered, saved, notifications] = await Promise.all([
    Match.countDocuments({ $or: [{ lostItem: { $in: ids } }, { foundItem: { $in: ids } }], status: 'suggested' }),
    Claim.countDocuments({ claimant: req.user._id, status: { $in: ['pending', 'under_review'] } }),
    Item.countDocuments({ reporter: req.user._id, status: 'returned' }),
    Bookmark.countDocuments({ user: req.user._id }),
    Notification.find({ recipient: req.user._id }).sort({ createdAt: -1 }).limit(5),
  ]);
  const active = own.filter((item) => ['active', 'possible_match', 'claim_requested', 'claim_under_review'].includes(item.status)).length;
  res.json({
    success: true,
    stats: {
      lost: own.filter((item) => item.reportType === 'lost').length,
      found: own.filter((item) => item.reportType === 'found').length,
      active, possibleMatches, pendingClaims, recovered, saved,
      recoveryRate: own.length ? Math.round((recovered / own.length) * 100) : 0,
    },
    recentActivity: own.slice(0, 5), notifications,
  });
});
