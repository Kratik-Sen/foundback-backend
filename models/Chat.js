import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema(
  {
    claim: { type: mongoose.Schema.Types.ObjectId, ref: 'Claim' },
    adminClaim: { type: mongoose.Schema.Types.ObjectId, ref: 'Claim', index: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true, index: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    kind: { type: String, enum: ['claim', 'item_contact', 'admin_claim'], default: 'claim', index: true },
    contactKey: { type: String, trim: true },
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    status: { type: String, enum: ['active', 'blocked', 'closed', 'reported'], default: 'active' },
    blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    activeViewers: [{
      _id: false,
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      lastSeenAt: { type: Date, required: true },
    }],
  },
  { timestamps: true },
);

chatSchema.methods.isActivelyViewedBy = function isActivelyViewedBy(userId, now = Date.now()) {
  const activeAfter = now - 20_000;
  return this.activeViewers?.some((viewer) => (
    String(viewer.user?._id || viewer.user) === String(userId)
    && new Date(viewer.lastSeenAt).getTime() >= activeAfter
  )) || false;
};

chatSchema.index({ participants: 1, updatedAt: -1 });
chatSchema.index({ claim: 1 }, { unique: true, partialFilterExpression: { claim: { $type: 'objectId' } }, name: 'unique_claim_chat' });
chatSchema.index({ contactKey: 1 }, { unique: true, sparse: true, name: 'unique_item_contact_chat' });

export default mongoose.model('Chat', chatSchema);
