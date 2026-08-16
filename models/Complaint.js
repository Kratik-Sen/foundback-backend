import mongoose from 'mongoose';

const complaintSchema = new mongoose.Schema(
  {
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
    claim: { type: mongoose.Schema.Types.ObjectId, ref: 'Claim' },
    chat: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat' },
    reportType: {
      type: String,
      enum: ['fake_listing', 'fraudulent_claim', 'inappropriate_image', 'abusive_chat', 'duplicate_listing', 'incorrect_information', 'suspicious_user'],
      required: true,
    },
    description: { type: String, required: true, trim: true, minlength: 10 },
    screenshot: { url: String, publicId: String },
    status: { type: String, enum: ['open', 'under_review', 'resolved', 'closed'], default: 'open', index: true },
    adminAction: { type: String, trim: true, maxlength: 1000 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export default mongoose.model('Complaint', complaintSchema);
