import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiAlertTriangle, FiCheckSquare, FiFolder, FiList } from 'react-icons/fi';
import api, { errMsg } from '../api';
import { useAuth } from '../AuthContext';
import {
  Card, EmptyState, ErrorState, FullSpinner, Page, StatusBadge, fmtDate, isOverdue,
} from '../ui';

export default function Dashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [projectCount, setProjectCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([api.get('/tasks/mine?limit=100'), api.get('/projects?limit=1')])
      .then(([t, p]) => {
        setTasks(t.data.data);
        setProjectCount(p.data.meta.total);
      })
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (loading) return <FullSpinner />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const open = tasks.filter((t) => t.status !== 'done');
  const stats = [
    { label: 'Projects', value: projectCount, icon: FiFolder, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'My open tasks', value: open.length, icon: FiList, color: 'text-blue-600 bg-blue-50' },
    { label: 'Overdue', value: tasks.filter(isOverdue).length, icon: FiAlertTriangle, color: 'text-red-600 bg-red-50' },
    { label: 'Completed', value: tasks.length - open.length, icon: FiCheckSquare, color: 'text-green-600 bg-green-50' },
  ];

  return (
    <Page title={`Welcome, ${user.name.split(' ')[0]}`} subtitle="Here is what's happening across your projects.">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="flex items-center gap-4 p-4">
              <div className={`rounded-lg p-3 ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Tasks assigned to me</h2>
      {tasks.length === 0 ? (
        <EmptyState title="No tasks assigned to you" text="Tasks assigned to you will show up here." />
      ) : (
        <Card className="divide-y divide-slate-100">
          {tasks.slice(0, 8).map((t) => (
            <Link key={t._id} to={`/tasks/${t._id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-slate-50">
              <div className="min-w-0">
                <p className="truncate font-medium">{t.title}</p>
                <p className="text-xs text-slate-500">{t.project?.name}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className={`hidden text-xs sm:block ${isOverdue(t) ? 'font-medium text-red-600' : 'text-slate-500'}`}>
                  {fmtDate(t.dueDate)}
                </span>
                <StatusBadge status={t.status} />
              </div>
            </Link>
          ))}
        </Card>
      )}
    </Page>
  );
}