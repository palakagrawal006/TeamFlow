import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../AuthContext';
import { errMsg } from '../api';
import { Button, Card, Input } from '../ui';

const DEMO = [
  ['Admin', 'admin@demo.com'],
  ['Manager', 'manager@demo.com'],
  ['Member', 'alice@demo.com'],
  ['Viewer', 'viewer@demo.com'],
];

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-3xl font-bold text-indigo-600">TeamFlow</h1>
        <p className="mb-6 text-center text-slate-500">Sign in to manage your projects</p>
        <Card className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input
              label="Password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <Button type="submit" loading={loading} className="w-full">
              Sign in
            </Button>
          </form>
        </Card>
        <div className="mt-4 text-center text-xs text-slate-500">
          <p className="mb-2">Demo accounts (password: Demo@123)</p>
          <div className="flex flex-wrap justify-center gap-2">
            {DEMO.map(([label, mail]) => (
              <button
                key={mail}
                onClick={() => {
                  setEmail(mail);
                  setPassword('Demo@123');
                }}
                className="rounded-full border border-slate-300 bg-white px-3 py-1 hover:bg-slate-50"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}