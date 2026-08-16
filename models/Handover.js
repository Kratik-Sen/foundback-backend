import mongoose from 'mongoose';

const handoverSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true, index: true },
    claim: { type: mongoose.Schema.Types.ObjectId, ref: 'Claim', required: true, unique: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    finder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    location: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    OTP: {
      type: String,
      select: false,
      required() { return this.status !== 'completed'; },
    },
    ownerConfirmed: { type: Boolean, default: false },
    finderConfirmed: { type: Boolean, default: false },
    staffConfirmed: { type: Boolean, default: false },
    status: { type: String, enum: ['scheduled', 'ready', 'completed', 'cancelled'], default: 'scheduled', index: true },
    notes: String,
  },
  { timestamps: true },
);

export default mongoose.model('Handover', handoverSchema);
