import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User, { ROLES } from '../models/User.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import {
  ApiError, asyncHandler, paginate, pageMeta, escapeRegex, isNonEmptyString,
} from '../utils.js';

const router = Router();
router.use(requireAuth);

const EMAIL_RX = /^\S+@\S+\.\S+$/;

// Used by the "add team member" picker. Admin or project managers only.
router.get(
  '/lookup',
  asyncHandler(async (req, res) => {
    if (!['admin', 'project_manager'].includes(req.user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Not allowed to search users');
    }
    const filter = { isActive: true };
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(req.query.q), 'i');
      filter.$or = [{ name: rx }, { email: rx }];
    }
    const users = await User.find(filter).select('name email role').sort('name').limit(20);
    res.json({ data: users });
  })
);

// Everything below is admin-only
router.use(requireAdmin);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginate(req.query);
    const filter = {};
    if (ROLES.includes(req.query.role)) filter.role = req.query.role;
    if (req.query.active === 'true') filter.isActive = true;
    if (req.query.active === 'false') filter.isActive = false;
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(req.query.q), 'i');
      filter.$or = [{ name: rx }, { email: rx }];
    }
    const [users, total] = await Promise.all([
      User.find(filter).sort('-createdAt').skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);
    res.json({ data: users, meta: pageMeta(page, limit, total) });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, email, password, role = 'team_member' } = req.body;
    if (!isNonEmptyString(name, 100)) throw new ApiError(400, 'VALIDATION_ERROR', 'Name is required');
    if (!isNonEmptyString(email) || !EMAIL_RX.test(email)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'A valid email is required');
    }
    if (typeof password !== 'string' || password.length < 6) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Password must be at least 6 characters');
    }
    if (!ROLES.includes(role)) throw new ApiError(400, 'VALIDATION_ERROR', `Role must be one of: ${ROLES.join(', ')}`);

    const user = await User.create({
      name: name.trim(),
      email,
      role,
      passwordHash: await bcrypt.hash(password, 10),
    });
    res.status(201).json({ data: user });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');
    res.json({ data: user });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');
    const { name, email, role, password } = req.body;

    if (name !== undefined) {
      if (!isNonEmptyString(name, 100)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid name');
      user.name = name.trim();
    }
    if (email !== undefined) {
      if (!EMAIL_RX.test(email)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid email');
      user.email = email;
    }
    if (role !== undefined) {
      if (!ROLES.includes(role)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid role');
      if (String(user._id) === String(req.user._id) && role !== 'admin') {
        throw new ApiError(400, 'VALIDATION_ERROR', 'You cannot remove your own admin role');
      }
      user.role = role;
    }
    if (password !== undefined) {
      if (typeof password !== 'string' || password.length < 6) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Password must be at least 6 characters');
      }
      user.passwordHash = await bcrypt.hash(password, 10);
    }
    await user.save();
    res.json({ data: user });
  })
);

async function setActive(req, res, isActive) {
  if (!isActive && String(req.params.id) === String(req.user._id)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'You cannot deactivate your own account');
  }
  const user = await User.findByIdAndUpdate(req.params.id, { isActive }, { new: true });
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  res.json({ data: user });
}

router.post('/:id/deactivate', asyncHandler((req, res) => setActive(req, res, false)));
router.post('/:id/activate', asyncHandler((req, res) => setActive(req, res, true)));

export default router;