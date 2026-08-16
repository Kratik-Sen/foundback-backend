import mongoose from 'mongoose';

const bookmarkSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true, index: true },
  },
  { timestamps: true },
);

bookmarkSchema.index({ user: 1, item: 1 }, { unique: true });

export default mongoose.model('Bookmark', bookmarkSchema);
