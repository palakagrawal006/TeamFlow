import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.js';

const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is missing in server/.env');
  process.exit(1);
}

connectDB()
  .then(() => app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`)))
  .catch((err) => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  });