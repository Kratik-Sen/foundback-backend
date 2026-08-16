import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema(
  {
    claim: { type: mongoose.Schema.Types.ObjectId, ref: 'Claim' },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true, index: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    kind: { type: String, enum: ['claim', 'item_contact'], default: 'claim', index: true },
    contactKey: { type: String, trim: true },
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    status: { type: String, enum: ['active', 'blocked', 'closed', 'reported'], default: 'active' },
    blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

chatSchema.index({ participants: 1, updatedAt: -1 });
chatSchema.index({ claim: 1 }, { unique: true, partialFilterExpression: { claim: { $type: 'objectId' } }, name: 'unique_claim_chat' });
chatSchema.index({ contactKey: 1 }, { unique: true, sparse: true, name: 'unique_item_contact_chat' });

export default mongoose.model('Chat', chatSchema);
