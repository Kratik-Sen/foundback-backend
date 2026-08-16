import 'dotenv/config';
import mongoose from 'mongoose';
import Item from '../models/Item.js';
import { generateMatches } from '../services/matchingService.js';

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');

const shouldApply = process.argv.includes('--apply');
const legacyFilter = {
  $or: [
    { approvalStatus: { $ne: 'approved' } },
    { status: { $in: ['pending_approval', 'rejected'] } },
  ],
};

await mongoose.connect(process.env.MONGODB_URI);

try {
  const candidates = await Item.find(legacyFilter).select('_id title').lean();
  console.log(`Found ${candidates.length} legacy listing(s) awaiting automatic publication.`);

  if (!shouldApply) {
    candidates.forEach((item) => console.log(`- ${item.title}`));
    console.log('Run with --apply to publish these listings.');
  } else if (candidates.length) {
    const ids = candidates.map((item) => item._id);
    await Item.updateMany(
      { _id: { $in: ids } },
      {
        $set: { approvalStatus: 'approved', status: 'active', approvedAt: new Date() },
        $unset: { approvedBy: 1, rejectionReason: 1 },
      },
    );

    const published = await Item.find({ _id: { $in: ids } });
    for (const item of published) await generateMatches(item);
    console.log(`Published ${published.length} listing(s) and refreshed possible matches.`);
  }
} finally {
  await mongoose.disconnect();
}
