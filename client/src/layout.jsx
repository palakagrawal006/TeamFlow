import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { FiFolder, FiHome, FiLogOut, FiMenu, FiUser, FiUsers, FiX } from 'react-icons/fi';
import { useAuth } from './AuthContext';
import { RoleBadge, cn } from './ui';

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const links = [
    { to: '/dashboard', label: 'Dashboard', icon: FiHome },
    { to: '/projects', label: 'Projects', icon: FiFolder },
    ...(user.role === 'admin' ? [{ to: '/users', label: 'Users', icon: FiUsers }] : []),
    { to: '/profile', label: 'Profile', icon: FiUser },
  ];

  return (
    <div className="min-h-screen">
      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-60 border-r border-slate-200 bg-white transition-transform lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <span className="text-lg font-bold text-indigo-600">TeamFlow</span>
          <button className="lg:hidden" onClick={() => setOpen(false)}>
            <FiX className="h-5 w-5" />
          </button>
        </div>
        <nav className="space-y-1 px-3">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                  isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button className="rounded p-2 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)}>
            <FiMenu className="h-5 w-5" />
          </button>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
            <RoleBadge role={user.role} />
            <button
              onClick={logout}
              title="Log out"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              <FiLogOut className="h-5 w-5" />
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-6xl p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}