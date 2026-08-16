import cron from 'node-cron';
import Item from '../models/Item.js';
import Notification from '../models/Notification.js';
import { notify } from '../services/notificationService.js';

export function startExpiryJob() {
  return cron.schedule('15 2 * * *', async () => {
    const now = new Date();
    const warningDate = new Date(now.getTime() + 7 * 86_400_000);
    const expiring = await Item.find({
      expiryDate: { $gt: now, $lte: warningDate },
      status: { $in: ['active', 'possible_match', 'claim_requested'] },
    });
    for (const item of expiring) {
      const alreadyWarned = await Notification.exists({ recipient: item.reporter, item: item._id, type: 'listing_expiring' });
      if (!alreadyWarned) await notify({ recipient: item.reporter, title: 'Listing expiring soon', message: `“${item.title}” will expire within seven days. Extend it if it is still relevant.`, type: 'listing_expiring', item: item._id });
    }
    await Item.updateMany({ expiryDate: { $lte: now }, status: { $nin: ['returned', 'closed', 'rejected'] } }, { status: 'expired' });
  }, { timezone: process.env.TZ || 'Asia/Kolkata' });
}
