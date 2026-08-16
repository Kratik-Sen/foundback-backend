import 'dotenv/config';
import mongoose from 'mongoose';
import Complaint from '../models/Complaint.js';
import Notification from '../models/Notification.js';

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');

await mongoose.connect(process.env.MONGODB_URI);

try {
  const complaints = await Complaint.find({
    status: { $in: ['resolved', 'closed'] },
    adminAction: { $type: 'string', $ne: '' },
  }).select('_id reportedBy item claim adminAction');

  let created = 0;
  for (const complaint of complaints) {
    const result = await Notification.updateOne(
      { recipient: complaint.reportedBy, type: 'complaint_resolved', complaint: complaint._id },
      {
        $setOnInsert: {
          recipient: complaint.reportedBy,
          title: 'Your complaint was reviewed',
          message: `Admin response: ${complaint.adminAction}`,
          type: 'complaint_resolved',
          item: complaint.item,
          claim: complaint.claim,
          complaint: complaint._id,
          read: false,
        },
      },
      { upsert: true },
    );
    if (result.upsertedCount) created += 1;
  }

  console.log(`Created ${created} complaint response notification(s).`);
} finally {
  await mongoose.disconnect();
}
