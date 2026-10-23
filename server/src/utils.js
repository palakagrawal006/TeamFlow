export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function paginate(query, defaultLimit = 10) {
  const page = Math.max(parseInt(query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit) || defaultLimit, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}

export const pageMeta = (page, limit, total) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit) || 1,
});

export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const isNonEmptyString = (v, max = 200) =>
  typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max;

export function notFound(req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found` },
  });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: Object.values(err.errors).map((e) => e.message),
      },
    });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ error: { code: 'INVALID_ID', message: `Invalid value for ${err.path}` } });
  }
  if (err.code === 11000) {
    return res.status(409).json({
      error: {
        code: 'DUPLICATE',
        message: `Duplicate value for: ${Object.keys(err.keyPattern || {}).join(', ')}`,
      },
    });
  }
  console.error(err);
  res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong' } });
}