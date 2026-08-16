import Item from '../models/Item.js';
import Match from '../models/Match.js';
import { notifyMany } from './notificationService.js';

const stopWords = new Set(['the', 'and', 'with', 'from', 'this', 'that', 'item', 'lost', 'found', 'near']);

function normalize(value = '') {
  return value.toString().toLowerCase().trim().replace(/[^a-z0-9\s]/g, ' ');
}

function words(value = '') {
  return new Set(normalize(value).split(/\s+/).filter((word) => word.length > 2 && !stopWords.has(word)));
}

function similarity(left = '', right = '') {
  const a = words(left);
  const b = words(right);
  if (!a.size || !b.size) return 0;
  const common = [...a].filter((word) => b.has(word)).length;
  return common / Math.max(a.size, b.size);
}

function closeText(left = '', right = '') {
  const a = normalize(left);
  const b = normalize(right);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a) || similarity(a, b) >= 0.5));
}

export function calculateMatchScore(lost, found) {
  let score = 0;
  const matchedFields = [];

  if (normalize(lost.category) === normalize(found.category)) { score += 25; matchedFields.push('category'); }
  if (closeText(lost.colour, found.colour)) { score += 15; matchedFields.push('colour'); }
  if (closeText(lost.brand, found.brand)) { score += 15; matchedFields.push('brand'); }
  if (closeText(`${lost.location} ${lost.building || ''}`, `${found.location} ${found.building || ''}`)) {
    score += 15; matchedFields.push('location');
  }
  const days = Math.abs(new Date(lost.date) - new Date(found.date)) / 86_400_000;
  if (days <= 3) { score += 15; matchedFields.push('date'); }
  const descriptiveSimilarity = similarity(`${lost.title} ${lost.description}`, `${found.title} ${found.description}`);
  if (descriptiveSimilarity > 0) {
    score += Math.min(15, Math.max(5, Math.round(descriptiveSimilarity * 15)));
    matchedFields.push('description');
  }
  return { score: Math.min(100, Math.round(score)), matchedFields };
}

export async function findDuplicateReports(userId, candidate) {
  const start = new Date(candidate.date);
  start.setDate(start.getDate() - 2);
  const end = new Date(candidate.date);
  end.setDate(end.getDate() + 2);
  const possibilities = await Item.find({
    reporter: userId,
    reportType: candidate.reportType,
    category: candidate.category,
    date: { $gte: start, $lte: end },
    status: { $nin: ['closed', 'rejected', 'expired'] },
  }).limit(5);
  return possibilities.filter((item) => {
    const titleSimilar = closeText(item.title, candidate.title);
    const locationSimilar = closeText(item.location, candidate.location);
    const descriptionSimilar = similarity(item.description, candidate.description) >= 0.35;
    return (titleSimilar && locationSimilar) || descriptionSimilar;
  });
}

export async function generateMatches(item) {
  const oppositeType = item.reportType === 'lost' ? 'found' : 'lost';
  const candidates = await Item.find({
    reportType: oppositeType,
    category: item.category,
    approvalStatus: 'approved',
    status: { $in: ['active', 'possible_match', 'claim_requested'] },
    expiryDate: { $gt: new Date() },
  });

  const created = [];
  for (const candidate of candidates) {
    const lost = item.reportType === 'lost' ? item : candidate;
    const found = item.reportType === 'found' ? item : candidate;
    const { score, matchedFields } = calculateMatchScore(lost, found);
    if (score < 45) continue;
    const match = await Match.findOneAndUpdate(
      { lostItem: lost._id, foundItem: found._id },
      { matchingScore: score, matchedFields, status: 'suggested' },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    created.push(match);
    await Item.updateMany({ _id: { $in: [lost._id, found._id] }, status: 'active' }, { status: 'possible_match' });
    const recipients = [lost.reporter, found.reporter];
    const notified = new Set((match.notifiedUsers || []).map(String));
    const newRecipients = recipients.filter((recipient) => !notified.has(String(recipient)));
    if (newRecipients.length) {
      await notifyMany(newRecipients, {
        title: 'A possible match was found',
        message: `FoundBack found a ${score}% match for “${item.title}”.`,
        type: 'possible_match',
        item: item._id,
      });
      await Match.updateOne({ _id: match._id }, { $addToSet: { notifiedUsers: { $each: newRecipients } } });
    }
  }
  return created;
}
