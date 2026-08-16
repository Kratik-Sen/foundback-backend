import mongoose from 'mongoose';

export const ITEM_STATUSES = [
  'pending_approval', 'active', 'possible_match', 'claim_requested', 'claim_under_review',
  'claim_approved', 'claim_rejected', 'handover_scheduled', 'returned', 'closed', 'rejected', 'expired',
];

const imageSchema = new mongoose.Schema({ url: { type: String, required: true }, publicId: String }, { _id: false });
const questionSchema = new mongoose.Schema(
  { question: { type: String, required: true, trim: true }, answer: { type: String, required: true, select: false, trim: true } },
  { _id: true },
);

const itemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    reportType: { type: String, enum: ['lost', 'found'], required: true, index: true },
    category: { type: String, required: true, trim: true, index: true },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 3000 },
    brand: { type: String, trim: true, maxlength: 80 },
    colour: { type: String, trim: true, maxlength: 60 },
    uniqueMarks: { type: String, trim: true, select: false },
    publicDetails: { type: String, trim: true },
    privateDetails: { type: String, trim: true, select: false },
    date: { type: Date, required: true, index: true },
    approximateTime: String,
    location: { type: String, required: true, trim: true, index: true },
    building: { type: String, trim: true },
    floor: { type: String, trim: true },
    room: { type: String, trim: true },
    landmark: { type: String, trim: true },
    images: [imageSchema],
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    currentHolder: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    securityOfficeSubmitted: { type: Boolean, default: false, index: true },
    currentItemLocation: String,
    contactPreference: { type: String, enum: ['chat', 'email', 'security_office'], default: 'chat' },
    handoverPreference: { type: String, trim: true },
    reward: { type: Number, min: 0, default: 0 },
    privacy: {
      hideReporter: { type: Boolean, default: false },
      hideExactLocation: { type: Boolean, default: false },
    },
    verificationQuestions: [questionSchema],
    status: { type: String, enum: ITEM_STATUSES, default: 'active', index: true },
    approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved', index: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    rejectionReason: String,
    views: { type: Number, default: 0, min: 0 },
    possibleMatches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Match' }],
    expiryDate: { type: Date, required: true, index: true },
    returnedAt: Date,
    duplicateAcknowledged: { type: Boolean, default: false },
  },
  { timestamps: true },
);

itemSchema.index({ title: 'text', description: 'text', brand: 'text', colour: 'text', location: 'text' });
itemSchema.index({ reportType: 1, approvalStatus: 1, status: 1, createdAt: -1 });
itemSchema.index({ reporter: 1, category: 1, date: 1 });

export default mongoose.model('Item', itemSchema);
