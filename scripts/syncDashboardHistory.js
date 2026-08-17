import '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import Item from '../models/Item.js';
import User from '../models/User.js';

const historyMarker = 'FoundBack historical dashboard demonstration record.';
const templates = [
  ['Library ID card', 'ID Card', 'Blue', 'Library'],
  ['Canteen wallet', 'Wallet', 'Black', 'Canteen'],
  ['Computer lab phone', 'Mobile Phone', 'Black', 'Computer Lab'],
  ['Classroom charger', 'Charger', 'White', 'Classroom Block'],
  ['Auditorium earbuds', 'Earphones', 'White', 'Auditorium'],
  ['Bus stop backpack', 'Bag', 'Navy', 'Bus Stop'],
];

function historicalDate(monthOffset, day) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - monthOffset, day, 10, 30);
}

async function syncDashboardHistory() {
  await connectDatabase();
  const reporters = await User.find({ role: 'student', accountStatus: 'active' }).sort({ createdAt: 1 }).limit(6);
  if (!reporters.length) throw new Error('At least one active student account is required');

  for (let monthOffset = 5; monthOffset >= 0; monthOffset -= 1) {
    const template = templates[5 - monthOffset];
    const [label, category, colour, location] = template;
    const reporter = reporters[(5 - monthOffset) % reporters.length]._id;

    for (const [typeIndex, reportType] of ['lost', 'found'].entries()) {
      const createdAt = historicalDate(monthOffset, 8 + typeIndex * 6);
      const returned = (monthOffset + typeIndex) % 2 === 0;
      const title = `${label} ${reportType} archive`;
      const item = await Item.findOneAndUpdate(
        { title, reportType, publicDetails: historyMarker },
        {
          $set: {
            title,
            reportType,
            category,
            colour,
            location,
            description: `Historical ${reportType} report used to demonstrate FoundBack recovery analytics.`,
            publicDetails: historyMarker,
            date: createdAt,
            approximateTime: typeIndex ? '14:15' : '10:30',
            building: location,
            reporter,
            currentHolder: reportType === 'found' ? reporter : null,
            contactPreference: 'chat',
            status: returned ? 'returned' : 'closed',
            approvalStatus: 'approved',
            approvedAt: createdAt,
            expiryDate: new Date(createdAt.getTime() + 90 * 86_400_000),
            returnedAt: returned ? new Date(createdAt.getTime() + (3 + monthOffset) * 86_400_000) : null,
            images: [{ url: '/demo/items/personal-items.png', publicId: `dashboard-${reportType}-${monthOffset}` }],
          },
        },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
      );
      await Item.collection.updateOne(
        { _id: item._id },
        { $set: { createdAt, updatedAt: createdAt } },
      );
    }
  }

  const monthly = await Item.aggregate([
    { $match: { publicDetails: historyMarker } },
    { $group: { _id: { month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, type: '$reportType' }, count: { $sum: 1 } } },
    { $sort: { '_id.month': 1, '_id.type': 1 } },
  ]);
  console.log(`FoundBack dashboard history synchronized: ${monthly.length} monthly report groups.`);
}

syncDashboardHistory()
  .then(() => disconnectDatabase())
  .catch(async (error) => {
    console.error(error);
    await disconnectDatabase().catch(() => {});
    process.exit(1);
  });
