import mongoose from 'mongoose';

const campusLocationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    building: { type: String, trim: true },
    floor: { type: String, trim: true },
    rooms: [{ type: String, trim: true }],
    landmark: { type: String, trim: true },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

export default mongoose.model('CampusLocation', campusLocationSchema);
