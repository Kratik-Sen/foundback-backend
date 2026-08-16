import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true, minlength: 8, select: false },
    enrollmentNumber: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
    phone: { type: String, trim: true, match: [/^[0-9+ -]{7,18}$/, 'Enter a valid phone number'] },
    course: { type: String, trim: true },
    branch: { type: String, trim: true },
    semester: { type: Number, min: 1, max: 12 },
    profileImage: {
      url: String,
      publicId: String,
    },
    role: { type: String, enum: ['student', 'staff', 'admin'], default: 'student', index: true },
    department: { type: String, trim: true },
    emailVerified: { type: Boolean, default: false },
    accountStatus: { type: String, enum: ['active', 'blocked', 'suspended'], default: 'active', index: true },
    warningCount: { type: Number, default: 0, min: 0 },
    lastLogin: Date,
    verificationToken: { type: String, select: false },
    verificationExpires: { type: Date, select: false },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
  },
  { timestamps: true },
);

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.set('toJSON', {
  transform: (_doc, value) => {
    delete value.password;
    delete value.verificationToken;
    delete value.resetPasswordToken;
    return value;
  },
});

export default mongoose.model('User', userSchema);
