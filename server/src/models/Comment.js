import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema(
  {
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true, versionKey: false }
);

commentSchema.index({ task: 1, createdAt: 1 });

export default mongoose.model('Comment', commentSchema);