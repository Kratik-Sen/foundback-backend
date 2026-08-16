import mongoose from 'mongoose';

const claimSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    claimant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reason: { type: String, required: true, trim: true, minlength: 10 },
    uniqueIdentificationAnswer: { type: String, required: true, trim: true, select: false },
    locationAnswer: { type: String, required: true, trim: true, select: false },
    dateAnswer: { type: Date, required: true, select: false },
    approximateTime: String,
    proofImages: [{ url: String, publicId: String, kind: String }],
    deviceSerialNumber: { type: String, select: false },
    additionalInformation: { type: String, trim: true },
    verificationAnswers: [{ questionId: mongoose.Schema.Types.ObjectId, question: String, answer: { type: String, select: false } }],
    status: {
      type: String,
      enum: ['pending', 'under_review', 'approved', 'rejected', 'cancelled', 'closed'],
      default: 'pending',
      index: true,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: String,
    approvedAt: Date,
  },
  { timestamps: true },
);

claimSchema.index({ item: 1, claimant: 1 }, { unique: true });
claimSchema.index({ item: 1 }, { unique: true, partialFilterExpression: { status: 'approved' } });

export default mongoose.model('Claim', claimSchema);
