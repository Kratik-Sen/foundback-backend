import '../config/env.js';
import crypto from 'node:crypto';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import AdminLog from '../models/AdminLog.js';
import Announcement from '../models/Announcement.js';
import Bookmark from '../models/Bookmark.js';
import CampusLocation from '../models/CampusLocation.js';
import Category from '../models/Category.js';
import Chat from '../models/Chat.js';
import Claim from '../models/Claim.js';
import Complaint from '../models/Complaint.js';
import ContactMessage from '../models/ContactMessage.js';
import Handover from '../models/Handover.js';
import Item from '../models/Item.js';
import Match from '../models/Match.js';
import Message from '../models/Message.js';
import Notification from '../models/Notification.js';
import Setting from '../models/Setting.js';
import Testimonial from '../models/Testimonial.js';
import User from '../models/User.js';
import { calculateMatchScore } from '../services/matchingService.js';

const categories = [
  ['ID Card', 'Badge'], ['Wallet', 'WalletCards'], ['Mobile Phone', 'Smartphone'], ['Charger', 'Cable'],
  ['Earphones', 'Headphones'], ['Laptop', 'Laptop'], ['Book', 'BookOpen'], ['Notebook', 'Notebook'],
  ['Keys', 'KeyRound'], ['Bag', 'Backpack'], ['Watch', 'Watch'], ['Calculator', 'Calculator'],
  ['Documents', 'Files'], ['Water Bottle', 'Bottle'], ['Clothing', 'Shirt'], ['Jewellery', 'Gem'], ['Other', 'Package'],
].map(([name, icon]) => ({ name, icon, description: `${name} reports`, active: true }));

const locationNames = [
  'Main Gate', 'Library', 'Canteen', 'Computer Lab', 'Parking Area', 'Auditorium', 'Classroom Block',
  'Sports Ground', 'Hostel', 'Administrative Block', 'Examination Hall', 'Bus Stop', 'Security Office',
];

const studentNames = ['Aarav Sharma', 'Diya Patel', 'Ishaan Verma', 'Meera Nair', 'Kabir Singh', 'Ananya Rao', 'Rohan Gupta', 'Zoya Khan'];

const demoImageByCategory = {
  'ID Card': '/demo/items/student-id.png',
  Wallet: '/demo/items/personal-items.png',
  Keys: '/demo/items/personal-items.png',
  Watch: '/demo/items/personal-items.png',
  Jewellery: '/demo/items/personal-items.png',
  'Mobile Phone': '/demo/items/electronics.png',
  Charger: '/demo/items/electronics.png',
  Earphones: '/demo/items/electronics.png',
  Laptop: '/demo/items/electronics.png',
  Calculator: '/demo/items/electronics.png',
  Book: '/demo/items/academic-items.png',
  Notebook: '/demo/items/academic-items.png',
  Documents: '/demo/items/academic-items.png',
  Bag: '/demo/items/student-belongings.png',
  'Water Bottle': '/demo/items/student-belongings.png',
  Clothing: '/demo/items/student-belongings.png',
  Other: '/demo/items/student-belongings.png',
};

const lostTemplates = [
  ['Blue college ID card', 'ID Card', 'Blue', 'Library', 'Plastic college identity card in a navy holder'],
  ['Black leather wallet', 'Wallet', 'Black', 'Canteen', 'Slim leather wallet with several cards'],
  ['Samsung mobile phone', 'Mobile Phone', 'Black', 'Computer Lab', 'Samsung phone in a dark protective case'],
  ['White USB-C charger', 'Charger', 'White', 'Classroom Block', 'Fast charging adapter with a USB-C cable'],
  ['Wireless earbuds case', 'Earphones', 'White', 'Auditorium', 'Small white wireless earbud charging case'],
  ['Engineering mathematics book', 'Book', 'Blue', 'Library', 'Hardcover engineering mathematics reference book'],
  ['Silver hostel room keys', 'Keys', 'Silver', 'Sports Ground', 'Two metal keys attached to a round key ring'],
  ['Grey laptop backpack', 'Bag', 'Grey', 'Bus Stop', 'Grey backpack with padded laptop compartment'],
  ['Scientific calculator', 'Calculator', 'Black', 'Examination Hall', 'Black Casio scientific calculator used for exams'],
  ['Steel water bottle', 'Water Bottle', 'Silver', 'Canteen', 'One litre stainless steel insulated bottle'],
  ['Brown analog watch', 'Watch', 'Brown', 'Classroom Block', 'Analog wrist watch with a brown strap'],
  ['Operating systems notebook', 'Notebook', 'Yellow', 'Computer Lab', 'Yellow ruled notebook containing OS class notes'],
  ['Placement documents folder', 'Documents', 'Blue', 'Administrative Block', 'Blue folder containing placement document copies'],
  ['Denim jacket', 'Clothing', 'Blue', 'Auditorium', 'Blue denim jacket with metal buttons'],
  ['HP laptop', 'Laptop', 'Silver', 'Library', 'Silver HP laptop in a thin sleeve'],
];

const foundTemplates = [
  ['Student ID in blue holder', 'ID Card', 'Blue', 'Library', 'College identity card inside a navy blue plastic holder'],
  ['Slim black wallet', 'Wallet', 'Black', 'Canteen', 'Black leather wallet found below a lunch table'],
  ['Samsung phone in case', 'Mobile Phone', 'Black', 'Computer Lab', 'Black Samsung smartphone with protective back case'],
  ['USB-C charging adapter', 'Charger', 'White', 'Classroom Block', 'White fast-charging adapter and type C cable'],
  ['White earbud case', 'Earphones', 'White', 'Auditorium', 'Wireless earbuds charging case found after an event'],
  ['Red spiral notebook', 'Notebook', 'Red', 'Library', 'Spiral notebook with handwritten lecture notes'],
  ['Keychain with three keys', 'Keys', 'Silver', 'Parking Area', 'Three keys on a small blue keychain'],
  ['Black sports backpack', 'Bag', 'Black', 'Sports Ground', 'Medium black backpack with a bottle pocket'],
  ['Casio calculator', 'Calculator', 'Black', 'Examination Hall', 'Scientific Casio calculator collected by invigilator'],
  ['Blue plastic water bottle', 'Water Bottle', 'Blue', 'Bus Stop', 'Reusable blue bottle with flip cap'],
  ['Digital wrist watch', 'Watch', 'Black', 'Canteen', 'Black digital wrist watch found near wash area'],
  ['Database systems textbook', 'Book', 'Green', 'Computer Lab', 'Green database management systems textbook'],
  ['Certificate file', 'Documents', 'Red', 'Administrative Block', 'Red file containing photocopied certificates'],
  ['Silver bracelet', 'Jewellery', 'Silver', 'Auditorium', 'Thin silver coloured bracelet found near the stage'],
  ['Dell laptop sleeve', 'Laptop', 'Grey', 'Security Office', 'Grey sleeve containing a Dell laptop handed to security'],
];

function itemFromTemplate(template, reportType, reporter, index) {
  const [title, category, colour, location, description] = template;
  const date = new Date();
  date.setDate(date.getDate() - (index % 10) - (reportType === 'found' ? 1 : 0));
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 90);
  return {
    title, reportType, category, colour, location, description,
    images: [{ url: demoImageByCategory[category] || '/demo/items/student-belongings.png', publicId: `demo-${category.toLowerCase().replaceAll(' ', '-')}` }],
    brand: ['Mobile Phone', 'Laptop'].includes(category) ? title.split(' ')[0] : category === 'Calculator' ? 'Casio' : '',
    publicDetails: 'Reported through the FoundBack demonstration dataset.',
    privateDetails: `Seed-only verification detail ${index + 1}`,
    uniqueMarks: `Private mark ${index + 1}`,
    date,
    approximateTime: `${9 + (index % 8)}:30`,
    building: location,
    reporter,
    currentHolder: reportType === 'found' ? reporter : undefined,
    securityOfficeSubmitted: reportType === 'found' && index % 3 === 0,
    currentItemLocation: reportType === 'found' && index % 3 === 0 ? 'Security Office' : undefined,
    contactPreference: 'chat',
    status: index === 14 && reportType === 'lost' ? 'returned' : 'active',
    approvalStatus: 'approved',
    approvedAt: new Date(),
    expiryDate,
    returnedAt: index === 14 && reportType === 'lost' ? new Date() : undefined,
    verificationQuestions: reportType === 'found' ? [{ question: 'Describe one private detail visible on the item.', answer: `Private mark ${index + 1}` }] : [],
  };
}

async function seed() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  if (process.env.NODE_ENV === 'production') throw new Error('Demo database seeding is disabled in production');
  const seedPassword = 'CampusFind@2026';
  await connectDatabase();

  const models = [AdminLog, Announcement, Bookmark, CampusLocation, Category, Chat, Claim, Complaint, ContactMessage, Handover, Item, Match, Message, Notification, Setting, Testimonial, User];
  await Promise.all(models.map((model) => model.deleteMany({})));

  const admin = await User.create({ name: 'Campus Administrator', email: 'admin@college.edu', password: seedPassword, role: 'admin', emailVerified: true });
  const staff = await Promise.all([
    User.create({ name: 'Neha Security', email: 'security@college.edu', password: seedPassword, role: 'staff', department: 'Security Office', emailVerified: true }),
    User.create({ name: 'Vikram Library', email: 'library.staff@college.edu', password: seedPassword, role: 'staff', department: 'Library', emailVerified: true }),
  ]);
  const students = [];
  for (const [index, name] of studentNames.entries()) {
    students.push(await User.create({
      name,
      email: `student${index + 1}@college.edu`,
      password: seedPassword,
      enrollmentNumber: `CF2026${String(index + 1).padStart(3, '0')}`,
      phone: `98765000${String(index + 1).padStart(2, '0')}`,
      course: index % 2 ? 'B.Tech' : 'BCA',
      branch: index % 2 ? 'Computer Science' : 'Information Technology',
      semester: (index % 6) + 1,
      role: 'student',
      emailVerified: true,
    }));
  }

  await Category.insertMany(categories);
  await CampusLocation.insertMany(locationNames.map((name, index) => ({ name, building: name, floor: index % 3 ? 'Ground' : 'First', rooms: [], landmark: `Near ${name}`, active: true })));
  await Setting.create([
    { key: 'listingExpiryDays', value: 90, description: 'Default listing validity', public: true, updatedBy: admin._id },
    { key: 'claimReviewMessage', value: 'Claims are reviewed by college staff before handover.', public: true, updatedBy: admin._id },
  ]);

  const lostItems = await Item.insertMany(lostTemplates.slice(0, 3).map((template, index) => itemFromTemplate(template, 'lost', students[index % students.length]._id, index)));
  const foundItems = await Item.insertMany(foundTemplates.slice(0, 3).map((template, index) => itemFromTemplate(template, 'found', students[(index + 3) % students.length]._id, index)));
  const matches = [];
  for (let index = 0; index < lostItems.length; index += 1) {
    const result = calculateMatchScore(lostItems[index], foundItems[index]);
    matches.push(await Match.create({ lostItem: lostItems[index]._id, foundItem: foundItems[index]._id, matchingScore: result.score, matchedFields: result.matchedFields, status: 'suggested', notifiedUsers: [lostItems[index].reporter, foundItems[index].reporter] }));
  }

  const claimOne = await Claim.create({
    item: foundItems[0]._id,
    claimant: students[0]._id,
    reason: 'The card has my photograph and enrollment details on it.',
    uniqueIdentificationAnswer: 'It is kept in a navy blue holder.',
    locationAnswer: 'Second floor reading room in the library.',
    dateAnswer: lostItems[0].date,
    verificationAnswers: [{ questionId: foundItems[0].verificationQuestions[0]._id, question: foundItems[0].verificationQuestions[0].question, answer: 'Private mark 1' }],
    status: 'pending',
  });
  const claimTwo = await Claim.create({
    item: foundItems[1]._id,
    claimant: students[1]._id,
    reason: 'The wallet matches the one I reported and contains my college card.',
    uniqueIdentificationAnswer: 'There is a small stitched initial inside.',
    locationAnswer: 'Near the canteen payment counter.',
    dateAnswer: lostItems[1].date,
    verificationAnswers: [{ questionId: foundItems[1].verificationQuestions[0]._id, question: foundItems[1].verificationQuestions[0].question, answer: 'Private mark 2' }],
    status: 'approved', reviewedBy: staff[0]._id, approvedAt: new Date(),
  });
  await Item.findByIdAndUpdate(foundItems[0]._id, { status: 'claim_requested' });
  await Item.findByIdAndUpdate(foundItems[1]._id, { status: 'handover_scheduled' });

  const chat = await Chat.create({ claim: claimOne._id, item: foundItems[0]._id, participants: [students[0]._id, foundItems[0].reporter] });
  const messages = await Message.create([
    { chat: chat._id, sender: students[0]._id, message: 'Hello, I submitted the private verification details.', readBy: [students[0]._id] },
    { chat: chat._id, sender: foundItems[0].reporter, message: 'Thanks. Security staff will review the claim shortly.', readBy: [foundItems[0].reporter] },
  ]);
  chat.lastMessage = messages[1]._id;
  await chat.save();

  const rawOtp = '482615';
  await Handover.create({
    item: foundItems[1]._id, claim: claimTwo._id, owner: students[1]._id, finder: foundItems[1].reporter,
    staff: staff[0]._id, location: 'Security Office', date: new Date(Date.now() + 2 * 86_400_000), time: '14:00',
    OTP: crypto.createHash('sha256').update(rawOtp).digest('hex'), status: 'scheduled', notes: 'Bring college ID.',
  });

  await Bookmark.create([{ user: students[0]._id, item: foundItems[0]._id }, { user: students[0]._id, item: foundItems[1]._id }]);
  await Notification.create([
    { recipient: students[0]._id, title: 'Possible match found', message: 'A found ID card is an 85% match.', type: 'possible_match', item: foundItems[0]._id },
    { recipient: foundItems[0].reporter, title: 'New claim received', message: 'A student submitted a claim for the ID card.', type: 'claim_submitted', item: foundItems[0]._id, claim: claimOne._id },
    { recipient: students[1]._id, title: 'Handover scheduled', message: 'Collect your wallet from the Security Office.', type: 'handover_scheduled', item: foundItems[1]._id, claim: claimTwo._id },
  ]);
  await Announcement.create({ title: 'Welcome to FoundBack', message: 'Use private verification details carefully and meet only at approved campus locations.', audience: 'all', createdBy: admin._id, active: true });
  await Testimonial.create([
    { name: 'Aarav Sharma', role: 'BCA, Semester 3', quote: 'The match suggestion found my ID card the same afternoon, and the private question made the handover feel safe.', order: 1 },
    { name: 'Neha Security', role: 'Campus Security', quote: 'QR labels and one structured claim record have made security-office handovers much easier to audit.', order: 2 },
    { name: 'Meera Nair', role: 'B.Tech CSE', quote: 'I could report a charger in under two minutes without sharing my phone number publicly.', order: 3 },
  ]);
  await AdminLog.create({ admin: admin._id, action: 'seed_demo_data', targetType: 'System', details: { users: 11, items: 6 }, ipAddress: '127.0.0.1' });

  console.log('FoundBack demo database seeded: 1 admin, 2 staff, 8 students, 6 items, 3 matches.');
  await disconnectDatabase();
}

seed().catch(async (error) => {
  console.error(error);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
