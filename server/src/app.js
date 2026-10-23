import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import projectRoutes from './routes/projects.js';
import taskRoutes from './routes/tasks.js';
import { notFound, errorHandler } from './utils.js';

const app = express();

app.use(cors({ origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',') }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    time: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api', taskRoutes); // /api/tasks/..., /api/comments/...

app.use(notFound);
app.use(errorHandler);

export default app;