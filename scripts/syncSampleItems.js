import '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import Item from '../models/Item.js';
import Match from '../models/Match.js';
import User from '../models/User.js';
import { calculateMatchScore } from '../services/matchingService.js';

const sampleMarker = 'Reported through the FoundBack demonstration dataset.';
const imageByCategory = {
  'ID Card': '/demo/items/student-id.png',
  Wallet: '/demo/items/personal-items.png',
  'Mobile Phone': '/demo/items/electronics.png',
};

const lostSamples = [
  ['Blue college ID card', 'ID Card', 'Blue', 'Library', 'Plastic college identity card in a navy holder'],
  ['Black leather wallet', 'Wallet', 'Black', 'Canteen', 'Slim leather wallet with several cards'],
  ['Samsung mobile phone', 'Mobile Phone', 'Black', 'Computer Lab', 'Samsung phone in a dark protective case'],
];

const foundSamples = [
  ['Student ID in blue holder', 'ID Card', 'Blue', 'Library', 'College identity card inside a navy blue plastic holder'],
  ['Slim black wallet', 'Wallet', 'Black', 'Canteen', 'Black leather wallet found below a lunch table'],
  ['Samsung phone in case', 'Mobile Phone', 'Black', 'Computer Lab', 'Black Samsung smartphone with protective back case'],
];

function sampleData(template, reportType, reporter, index) {
  const [title, category, colour, location, description] = template;
  const date = new Date();
  date.setDate(date.getDate() - index - (reportType === 'found' ? 1 : 0));
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 90);

  return {
    title,
    reportType,
    category,
    colour,
    location,
    description,
    images: [{ url: imageByCategory[category], publicId: `demo-${reportType}-${category.toLowerCase().replaceAll(' ', '-')}` }],
    brand: category === 'Mobile Phone' ? 'Samsung' : '',
    publicDetails: sampleMarker,
    privateDetails: `Sample-only verification detail ${index + 1}`,
    uniqueMarks: `Private sample mark ${index + 1}`,
    date,
    approximateTime: `${10 + index}:30`,
    building: location,
    reporter,
    currentHolder: reportType === 'found' ? reporter : null,
    securityOfficeSubmitted: reportType === 'found' && index === 0,
    currentItemLocation: reportType === 'found' && index === 0 ? 'Security Office' : '',
    contactPreference: 'chat',
    status: 'active',
    approvalStatus: 'approved',
    approvedAt: new Date(),
    expiryDate,
    verificationQuestions: reportType === 'found'
      ? [{ question: 'Describe one private detail visible on the item.', answer: `Private sample mark ${index + 1}` }]
      : [],
  };
}

async function upsertSample(template, reportType, reporter, index) {
  const [title] = template;
  return Item.findOneAndUpdate(
    { title, reportType, publicDetails: sampleMarker },
    { $set: sampleData(template, reportType, reporter, index) },
    { new: true, runValidators: true, setDefaultsOnInsert: true, upsert: true },
  );
}

async function syncSampleItems() {
  await connectDatabase();
  const students = await User.find({ role: 'student', accountStatus: 'active' }).sort({ createdAt: 1 }).limit(6);
  if (students.length < 6) throw new Error('At least six active student accounts are required to assign the sample reports');

  for (let index = 0; index < 3; index += 1) {
    const lostItem = await upsertSample(lostSamples[index], 'lost', students[index]._id, index);
    const foundItem = await upsertSample(foundSamples[index], 'found', students[index + 3]._id, index);
    const result = calculateMatchScore(lostItem, foundItem);
    const match = await Match.findOneAndUpdate(
      { lostItem: lostItem._id, foundItem: foundItem._id },
      {
        $set: {
          matchingScore: result.score,
          matchedFields: result.matchedFields,
          status: 'suggested',
          notifiedUsers: [lostItem.reporter, foundItem.reporter],
        },
      },
      { new: true, setDefaultsOnInsert: true, upsert: true },
    );
    await Promise.all([
      Item.findByIdAndUpdate(lostItem._id, { $addToSet: { possibleMatches: match._id } }),
      Item.findByIdAndUpdate(foundItem._id, { $addToSet: { possibleMatches: match._id } }),
    ]);
  }

  const counts = await Item.aggregate([
    { $match: { publicDetails: sampleMarker, approvalStatus: 'approved', status: 'active' } },
    { $group: { _id: '$reportType', count: { $sum: 1 } } },
  ]);
  console.log(`FoundBack samples synchronized: ${counts.map(({ _id, count }) => `${count} ${_id}`).join(', ')}.`);
}

syncSampleItems()
  .then(() => disconnectDatabase())
  .catch(async (error) => {
    console.error(error);
    await disconnectDatabase().catch(() => {});
    process.exit(1);
  });
