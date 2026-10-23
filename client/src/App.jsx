import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { FullSpinner } from './ui';
import Layout from './Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import TaskDetail from './pages/TaskDetail';
import Users from './pages/Users';
import Profile from './pages/Profile';

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <FullSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetail tab="tasks" />} />
        <Route path="/projects/:id/tasks" element={<ProjectDetail tab="tasks" />} />
        <Route path="/projects/:id/team" element={<ProjectDetail tab="team" />} />
        <Route path="/tasks/:id" element={<TaskDetail />} />
        <Route
          path="/users"
          element={
            <Protected roles={['admin']}>
              <Users />
            </Protected>
          }
        />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}