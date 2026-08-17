import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    type: { type: String, required: true, index: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
    claim: { type: mongoose.Schema.Types.ObjectId, ref: 'Claim' },
    chat: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', index: true },
    complaint: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint' },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
notificationSchema.index(
  { recipient: 1, type: 1, complaint: 1 },
  { unique: true, partialFilterExpression: { type: 'complaint_resolved', complaint: { $type: 'objectId' } } },
);

export default mongoose.model('Notification', notificationSchema);
