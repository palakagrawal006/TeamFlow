import { Router } from 'express';
import Task from '../models/Task.js';
import Comment from '../models/Comment.js';
import {
  requireAuth, getProjectAccess, isManager, assertManager,
  assertNotArchived, isProjectMember,
} from '../middleware/auth.js';
import { ApiError, asyncHandler, paginate, pageMeta, isNonEmptyString } from '../utils.js';

const router = Router();
router.use(requireAuth);

async function loadTask(id, user) {
  const task = await Task.findById(id);
  if (!task) throw new ApiError(404, 'NOT_FOUND', 'Task not found');
  const { project, role } = await getProjectAccess(task.project, user);
  return { task, project, role };
}

// What can this user do with this task? Sent to the UI to show/hide buttons.
function taskPerms(role, task, project, user) {
  if (project.status === 'archived') {
    return { canEdit: false, canAssign: false, canDelete: false, canComment: false };
  }
  const manager = isManager(role);
  const isAssignee = task.assignee && String(task.assignee) === String(user._id);
  return {
    canEdit: manager || (role === 'member' && Boolean(isAssignee)),
    canAssign: manager,
    canDelete: manager,
    canComment: role !== 'viewer',
  };
}

const POPULATE = [
  { path: 'assignee', select: 'name email' },
  { path: 'createdBy', select: 'name' },
  { path: 'project', select: 'name status' },
];

/* ---------------- Tasks ---------------- */

// Must be declared before '/tasks/:id'
// all tasks
router.get(
  '/tasks/mine',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginate(req.query, 20);
    const filter = { assignee: req.user._id };
    if (req.query.status) filter.status = req.query.status;
    const [tasks, total] = await Promise.all([
      Task.find(filter).sort('-updatedAt').skip(skip).limit(limit).populate('project', 'name status'),
      Task.countDocuments(filter),
    ]);
    res.json({ data: tasks, meta: pageMeta(page, limit, total) });
  })
);

// permissions
router.get(
  '/tasks/:id',
  asyncHandler(async (req, res) => {
    const { task, project, role } = await loadTask(req.params.id, req.user);
    const permissions = taskPerms(role, task, project, req.user);
    await task.populate(POPULATE);
    res.json({ data: task, meta: { myRole: role, permissions } });
  })
);

// to make update- concurrency 
router.patch(
  '/tasks/:id',
  asyncHandler(async (req, res) => {
    const { version } = req.body;
    if (!Number.isInteger(version)) {
      throw new ApiError(400, 'VALIDATION_ERROR', '`version` (integer) is required to update a task');
    }
    const { task, project, role } = await loadTask(req.params.id, req.user);
    assertNotArchived(project);
    const perms = taskPerms(role, task, project, req.user);
    if (!perms.canEdit) throw new ApiError(403, 'FORBIDDEN', 'You are not allowed to edit this task');

    const updates = {};
    for (const key of ['title', 'description', 'status', 'priority', 'dueDate']) {
      if (key in req.body) updates[key] = req.body[key];
    }
    if ('title' in updates) {
      if (!isNonEmptyString(updates.title, 200)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid title');
      updates.title = updates.title.trim();
    }
    if ('dueDate' in updates && !updates.dueDate) updates.dueDate = null;

    if ('assignee' in req.body) {
      if (!perms.canAssign) throw new ApiError(403, 'FORBIDDEN', 'Only a project manager or admin can assign tasks');
      const a = req.body.assignee || null;
      if (a && !isProjectMember(project, a)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Assignee must be a member of this project');
      }
      updates.assignee = a;
    }
    if (Object.keys(updates).length === 0) throw new ApiError(400, 'NO_CHANGES', 'No updatable fields were provided');

    // Atomic optimistic-concurrency check: only matches if the version is still the one the client saw
    const updated = await Task.findOneAndUpdate(
      { _id: task._id, version },
      { $set: updates, $inc: { version: 1 } },
      { new: true, runValidators: true }
    ).populate(POPULATE);

    if (!updated) {
      const current = await Task.findById(task._id).populate(POPULATE);
      if (!current) throw new ApiError(404, 'NOT_FOUND', 'Task no longer exists');
      throw new ApiError(
        409,
        'VERSION_CONFLICT',
        'This task was changed by someone else. Review the latest version and try again.',
        { current }
      );
    }
    res.json({ data: updated });
  })
);

router.delete(
  '/tasks/:id',
  asyncHandler(async (req, res) => {
    const { task, project, role } = await loadTask(req.params.id, req.user);
    assertManager(role);
    assertNotArchived(project);
    await Comment.deleteMany({ task: task._id });
    await task.deleteOne();
    res.status(204).end();
  })
);

/* ---------------- Comments ---------------- */
// show comments
router.get(
  '/tasks/:id/comments',
  asyncHandler(async (req, res) => {
    const { task } = await loadTask(req.params.id, req.user);
    const comments = await Comment.find({ task: task._id })
      .sort('createdAt')
      .limit(200)
      .populate('author', 'name role');
    res.json({ data: comments });
  })
);
// make comments
router.post(
  '/tasks/:id/comments',
  asyncHandler(async (req, res) => {
    const { task, project, role } = await loadTask(req.params.id, req.user);
    assertNotArchived(project);
    if (role === 'viewer') throw new ApiError(403, 'FORBIDDEN', 'Viewers cannot comment');
    const { body } = req.body;
    if (!isNonEmptyString(body, 2000)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Comment is required (max 2000 characters)');
    }
    const comment = await Comment.create({ task: task._id, author: req.user._id, body: body.trim() });
    await comment.populate('author', 'name role');
    res.status(201).json({ data: comment });
  })
);

router.delete(
  '/comments/:id',
  asyncHandler(async (req, res) => {
    const comment = await Comment.findById(req.params.id);
    if (!comment) throw new ApiError(404, 'NOT_FOUND', 'Comment not found');
    const { role } = await loadTask(comment.task, req.user);
    const own = String(comment.author) === String(req.user._id);
    if (!(isManager(role) || (own && role !== 'viewer'))) {
      throw new ApiError(403, 'FORBIDDEN', 'You can only delete your own comments');
    }
    await comment.deleteOne();
    res.status(204).end();
  })
);

export default router;