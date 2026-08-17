const historyMarker = 'FoundBack historical dashboard demonstration record.';
const templates = [
  ['Library ID card', 'ID Card', 'Blue', 'Library'],
  ['Canteen wallet', 'Wallet', 'Black', 'Canteen'],
  ['Computer lab phone', 'Mobile Phone', 'Black', 'Computer Lab'],
  ['Classroom charger', 'Charger', 'White', 'Classroom Block'],
  ['Auditorium earbuds', 'Earphones', 'White', 'Auditorium'],
  ['Bus stop backpack', 'Bag', 'Navy', 'Bus Stop'],
];
const reporters = db.users.find({ role: 'student', accountStatus: 'active' }).sort({ createdAt: 1 }).limit(6).toArray();

if (!reporters.length) throw new Error('At least one active student account is required');

for (let monthOffset = 5; monthOffset >= 0; monthOffset -= 1) {
  const [label, category, colour, location] = templates[5 - monthOffset];
  const reporter = reporters[(5 - monthOffset) % reporters.length]._id;

  for (const [typeIndex, reportType] of ['lost', 'found'].entries()) {
    const now = new Date();
    const createdAt = new Date(now.getFullYear(), now.getMonth() - monthOffset, 8 + typeIndex * 6, 10, 30);
    const returned = (monthOffset + typeIndex) % 2 === 0;
    const title = `${label} ${reportType} archive`;
    db.items.updateOne(
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
          privacy: { hideReporter: false, hideExactLocation: false },
          securityOfficeSubmitted: false,
          reward: 0,
          views: 0,
          possibleMatches: [],
          duplicateAcknowledged: false,
          createdAt,
          updatedAt: createdAt,
        },
      },
      { upsert: true },
    );
  }
}

const monthly = db.items.aggregate([
  { $match: { publicDetails: historyMarker } },
  { $group: { _id: { month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, type: '$reportType' }, count: { $sum: 1 } } },
  { $sort: { '_id.month': 1, '_id.type': 1 } },
]).toArray();

print(JSON.stringify({ records: db.items.countDocuments({ publicDetails: historyMarker }), monthly }, null, 2));
