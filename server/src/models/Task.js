import mongoose from 'mongoose';

export const STATUSES = ['todo', 'in_progress', 'in_review', 'done'];
export const PRIORITIES = ['low', 'medium', 'high'];

const taskSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 3000 },
    status: { type: String, enum: STATUSES, default: 'todo' },
    priority: { type: String, enum: PRIORITIES, default: 'medium' },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dueDate: { type: Date, default: null },
    version: { type: Number, default: 1 }, // optimistic concurrency counter
  },
  { timestamps: true, versionKey: false }
);

taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ assignee: 1 });

export default mongoose.model('Task', taskSchema);