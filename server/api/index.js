import app from '../src/app.js';
import { connectDB } from '../src/config/db.js';

let ready;

export default async function handler(req, res) {
  try {
    ready ??= connectDB();
    await ready;
  } catch (err) {
    ready = undefined; // retry on the next request
    console.error('DB connection failed:', err.message);
    return res.status(500).json({ error: { message: 'Database connection failed' } });
  }
  return app(req, res);
}