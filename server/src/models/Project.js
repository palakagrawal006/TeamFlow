import mongoose from 'mongoose';

export const PROJECT_ROLES = ['manager', 'member', 'viewer'];

const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: PROJECT_ROLES, default: 'member' },
  },
  { _id: false } //create using uuid
);

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: '', maxlength: 1000 },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [memberSchema],
  },
  { timestamps: true, versionKey: false }
);

projectSchema.index({ 'members.user': 1 });

export default mongoose.model('Project', projectSchema);