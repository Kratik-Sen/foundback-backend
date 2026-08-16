import 'dotenv/config';
import mongoose from 'mongoose';

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');

await mongoose.connect(process.env.MONGODB_URI);

try {
  const chats = mongoose.connection.collection('chats');
  const indexes = await chats.indexes().catch(() => []);
  const legacyClaimIndex = indexes.find((index) => index.name === 'claim_1');
  if (legacyClaimIndex) await chats.dropIndex(legacyClaimIndex.name);

  await chats.createIndex(
    { claim: 1 },
    { unique: true, partialFilterExpression: { claim: { $type: 'objectId' } }, name: 'unique_claim_chat' },
  );
  await chats.createIndex(
    { contactKey: 1 },
    { unique: true, sparse: true, name: 'unique_item_contact_chat' },
  );
  console.log('Chat indexes are ready for claim and direct item-contact conversations.');
} finally {
  await mongoose.disconnect();
}
