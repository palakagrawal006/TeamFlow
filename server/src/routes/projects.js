import { Router } from 'express';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Comment from '../models/Comment.js';
import User from '../models/User.js';
import { PROJECT_ROLES } from '../models/Project.js';
import {
  requireAuth, requireAdmin, getProjectAccess, projectRoleOf,
  assertManager, assertNotArchived, isProjectMember,
} from '../middleware/auth.js';
import {
  ApiError, asyncHandler, paginate, pageMeta, escapeRegex, isNonEmptyString,
} from '../utils.js';

const router = Router();
router.use(requireAuth);

const MEMBER_FIELDS = 'name email role isActive';
const populateProject = (q) => q.populate('createdBy', 'name').populate('members.user', MEMBER_FIELDS);

/* ---------------- Projects ---------------- */

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginate(req.query, 12);
    const filter = {};
    if (req.user.role !== 'admin') filter['members.user'] = req.user._id;
    if (['active', 'archived'].includes(req.query.status)) filter.status = req.query.status;
    if (req.query.q) filter.name = new RegExp(escapeRegex(req.query.q), 'i');

    const [projects, total] = await Promise.all([
      Project.find(filter).sort('-createdAt').skip(skip).limit(limit).populate('createdBy', 'name'),
      Project.countDocuments(filter),
    ]);

    const counts = await Task.aggregate([
      { $match: { project: { $in: projects.map((p) => p._id) } } },
      {
        $group: {
          _id: '$project',
          total: { $sum: 1 },
          done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
        },
      },
    ]);
    const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c]));

    const data = projects.map((p) => ({
      ...p.toJSON(),
      myRole: projectRoleOf(p, req.user),
      memberCount: p.members.length,
      taskCount: countMap[String(p._id)]?.total || 0,
      doneCount: countMap[String(p._id)]?.done || 0,
    }));
    res.json({ data, meta: pageMeta(page, limit, total) });
  })
);

router.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { name, description = '', managerId } = req.body;
    if (!isNonEmptyString(name, 100)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Project name is required (max 100 characters)');
    }
    const members = [];
    if (managerId) {
      const mgr = await User.findById(managerId);
      if (!mgr || !mgr.isActive) throw new ApiError(400, 'VALIDATION_ERROR', 'Manager not found or inactive');
      if (!['admin', 'project_manager'].includes(mgr.role)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Manager must have the Project Manager or Admin role');
      }
      members.push({ user: mgr._id, role: 'manager' });
    }
    const project = await Project.create({
      name: name.trim(), description, createdBy: req.user._id, members,
    });
    res.status(201).json({ data: project });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { project, role } = await getProjectAccess(req.params.id, req.user);
    await project.populate([
      { path: 'createdBy', select: 'name' },
      { path: 'members.user', select: MEMBER_FIELDS },
    ]);
    res.json({ data: { ...project.toJSON(), myRole: role } });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { project, role } = await getProjectAccess(req.params.id, req.user);
    assertManager(role);
    assertNotArchived(project);
    const { name, description } = req.body;
    if (name !== undefined) {
      if (!isNonEmptyString(name, 100)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid name');
      project.name = name.trim();
    }
    if (description !== undefined) project.description = description;
    await project.save();
    res.json({ data: project });
  })
);

async function setArchived(req, res, status) {
  const project = await Project.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!project) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  res.json({ data: project });
}
router.post('/:id/archive', requireAdmin, asyncHandler((req, res) => setArchived(req, res, 'archived')));
router.post('/:id/unarchive', requireAdmin, asyncHandler((req, res) => setArchived(req, res, 'active')));

router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const project = await Project.findById(req.params.id);
    if (!project) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
    const taskIds = (await Task.find({ project: project._id }).select('_id')).map((t) => t._id);
    await Comment.deleteMany({ task: { $in: taskIds } });
    await Task.deleteMany({ project: project._id });
    await project.deleteOne();
    res.status(204).end();
  })
);

/* ---------------- Team members ---------------- */

router.get(
  '/:id/members',
  asyncHandler(async (req, res) => {
    const { project } = await getProjectAccess(req.params.id, req.user);
    await project.populate('members.user', MEMBER_FIELDS);
    res.json({ data: project.members });
  })
);

router.post(
  '/:id/members',
  asyncHandler(async (req, res) => {
    const { project, role } = await getProjectAccess(req.params.id, req.user);
    assertManager(role);
    assertNotArchived(project);
    const { userId, projectRole = 'member' } = req.body;
    if (!PROJECT_ROLES.includes(projectRole)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid project role');
    if (projectRole === 'manager' && role !== 'admin') {
      throw new ApiError(403, 'FORBIDDEN', 'Only an admin can assign a project manager');
    }
    const user = await User.findById(userId);
    if (!user || !user.isActive) throw new ApiError(400, 'VALIDATION_ERROR', 'User not found or inactive');
    if (projectRole === 'manager' && !['admin', 'project_manager'].includes(user.role)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Manager must have the Project Manager or Admin role');
    }
    if (isProjectMember(project, user._id)) {
      throw new ApiError(409, 'DUPLICATE_MEMBER', 'User is already a member of this project');
    }
    project.members.push({ user: user._id, role: projectRole });
    await project.save();
    await project.populate('members.user', MEMBER_FIELDS);
    res.status(201).json({ data: project.members });
  })
);

router.patch(
  '/:id/members/:userId',
  asyncHandler(async (req, res) => {
    const { project, role } = await getProjectAccess(req.params.id, req.user);
    assertManager(role);
    assertNotArchived(project);
    const newRole = req.body.projectRole;
    if (!PROJECT_ROLES.includes(newRole)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid project role');
    const member = project.members.find((m) => String(m.user) === req.params.userId);
    if (!member) throw new ApiError(404, 'NOT_FOUND', 'Member not found in this project');

    // Promoting to or demoting from manager is an admin-only action
    if ((newRole === 'manager' || member.role === 'manager') && role !== 'admin') {
      throw new ApiError(403, 'FORBIDDEN', 'Only an admin can change a project manager assignment');
    }
    if (newRole === 'manager') {
      const user = await User.findById(member.user);
      if (!['admin', 'project_manager'].includes(user.role)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Manager must have the Project Manager or Admin role');
      }
    }
    member.role = newRole;
    await project.save();
    await project.populate('members.user', MEMBER_FIELDS);
    res.json({ data: project.members });
  })
);

router.delete(
  '/:id/members/:userId',
  asyncHandler(async (req, res) => {
    const { project, role } = await getProjectAccess(req.params.id, req.user);
    assertManager(role);
    assertNotArchived(project);
    const member = project.members.find((m) => String(m.user) === req.params.userId);
    if (!member) throw new ApiError(404, 'NOT_FOUND', 'Member not found in this project');
    if (member.role === 'manager' && role !== 'admin') {
      throw new ApiError(403, 'FORBIDDEN', 'Only an admin can remove a project manager');
    }
    project.members = project.members.filter((m) => String(m.user) !== req.params.userId);
    await project.save();
    // Unassign their tasks (bump version so open editors get a conflict)
    await Task.updateMany(
      { project: project._id, assignee: req.params.userId },
      { $set: { assignee: null }, $inc: { version: 1 } }
    );
    res.status(204).end();
  })
);

/* ---------------- Tasks inside a project ---------------- */

router.get(
  '/:id/tasks',
  asyncHandler(async (req, res) => {
    const { project } = await getProjectAccess(req.params.id, req.user);
    const { page, limit, skip } = paginate(req.query, 20);
    const filter = { project: project._id };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.assignee === 'me') filter.assignee = req.user._id;
    else if (req.query.assignee === 'none') filter.assignee = null;
    else if (req.query.assignee) filter.assignee = req.query.assignee;
    if (req.query.q) filter.title = new RegExp(escapeRegex(req.query.q), 'i');

    const sortParam = String(req.query.sort || '-createdAt');
    const sort = ['createdAt', 'updatedAt', 'dueDate', 'title'].includes(sortParam.replace(/^-/, ''))
      ? sortParam
      : '-createdAt';

    const [tasks, total] = await Promise.all([
      Task.find(filter).sort(sort).skip(skip).limit(limit).populate('assignee', 'name email'),
      Task.countDocuments(filter),
    ]);
    res.json({ data: tasks, meta: pageMeta(page, limit, total) });
  })
);

router.post(
  '/:id/tasks',
  asyncHandler(async (req, res) => {
    const { project, role } = await getProjectAccess(req.params.id, req.user);
    assertManager(role);
    assertNotArchived(project);
    const { title, description, status, priority, assignee, dueDate } = req.body;
    if (!isNonEmptyString(title, 200)) throw new ApiError(400, 'VALIDATION_ERROR', 'Task title is required');
    if (assignee && !isProjectMember(project, assignee)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Assignee must be a member of this project');
    }
    const task = await Task.create({
      project: project._id,
      title: title.trim(),
      description,
      status,
      priority,
      assignee: assignee || null,
      dueDate: dueDate || null,
      createdBy: req.user._id,
    });
    await task.populate('assignee', 'name email');
    res.status(201).json({ data: task });
  })
);

export default router;