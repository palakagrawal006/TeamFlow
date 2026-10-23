import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Project from '../models/Project.js';
import { ApiError, asyncHandler } from '../utils.js';

export const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'Login required');

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new ApiError(401, 'INVALID_TOKEN', 'Invalid or expired token');
  }

  // Re-check the DB on every request so deactivation takes effect immediately
  const user = await User.findById(payload.id);
  if (!user) throw new ApiError(401, 'INVALID_TOKEN', 'User no longer exists');
  if (!user.isActive) throw new ApiError(403, 'DEACTIVATED', 'This account is deactivated');
  req.user = user;
  next();
});



export const requireAdmin = (req, res, next) =>
  req.user.role === 'admin'
    ? next()
    : next(new ApiError(403, 'FORBIDDEN', 'Admin access required'));

const idOf = (ref) => String(ref?._id ?? ref);



export const isProjectMember = (project, userId) =>
  project.members.some((m) => idOf(m.user) === String(userId));

// Returns 'admin' | 'manager' | 'member' | 'viewer' | null
export function projectRoleOf(project, user) {
  if (user.role === 'admin') return 'admin';
  const m = project.members.find((x) => idOf(x.user) === String(user._id));
  return m ? m.role : null;
}

export async function getProjectAccess(projectId, user) {
  const project = await Project.findById(projectId);
  if (!project) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  const role = projectRoleOf(project, user);
  if (!role) throw new ApiError(403, 'FORBIDDEN', 'You are not a member of this project');
  return { project, role };
}

export const isManager = (role) => role === 'admin' || role === 'manager';

export function assertManager(role) {
  if (!isManager(role)) {
    throw new ApiError(403, 'FORBIDDEN', 'Project manager or admin access required');
  }
}

export function assertNotArchived(project) {
  if (project.status === 'archived') {
    throw new ApiError(409, 'PROJECT_ARCHIVED', 'This project is archived and read-only');
  }
}