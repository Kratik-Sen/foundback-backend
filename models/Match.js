import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema(
  {
    lostItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true, index: true },
    foundItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true, index: true },
    matchingScore: { type: Number, required: true, min: 0, max: 100 },
    matchedFields: [String],
    status: { type: String, enum: ['suggested', 'dismissed', 'confirmed'], default: 'suggested' },
    notifiedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true },
);

matchSchema.index({ lostItem: 1, foundItem: 1 }, { unique: true });

export default mongoose.model('Match', matchSchema);
