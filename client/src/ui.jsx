import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiAlertCircle, FiCheckCircle, FiInbox, FiX } from 'react-icons/fi';

export const cn = (...c) => c.filter(Boolean).join(' ');

export const STATUS = {
  todo: { label: 'To do', cls: 'bg-slate-100 text-slate-700' },
  in_progress: { label: 'In progress', cls: 'bg-blue-100 text-blue-700' },
  in_review: { label: 'In review', cls: 'bg-amber-100 text-amber-700' },
  done: { label: 'Done', cls: 'bg-green-100 text-green-700' },
};
export const PRIORITY = {
  low: { label: 'Low', cls: 'bg-slate-100 text-slate-600' },
  medium: { label: 'Medium', cls: 'bg-indigo-100 text-indigo-700' },
  high: { label: 'High', cls: 'bg-red-100 text-red-700' },
};
export const ROLE_LABEL = {
  admin: 'Admin',
  project_manager: 'Project Manager',
  team_member: 'Team Member',
  viewer: 'Viewer',
  manager: 'Manager',
  member: 'Member',
};

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const isOverdue = (t) => {
  if (!t.dueDate || t.status === 'done') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(t.dueDate) < today;
};

/* ---------- Basic elements ---------- */

export function Spinner({ small }) {
  return (
    <span
      className={cn(
        'inline-block animate-spin rounded-full border-2 border-current border-t-transparent',
        small ? 'h-4 w-4' : 'h-6 w-6 text-indigo-600'
      )}
    />
  );
}

export function FullSpinner() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Spinner />
    </div>
  );
}

const variants = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'text-slate-600 hover:bg-slate-100',
};

export function Button({ variant = 'primary', loading, className, children, disabled, ...props }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className
      )}
      {...props}
    >
      {loading && <Spinner small />}
      {children}
    </button>
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50 disabled:text-slate-500';

function Field({ label, hint, children }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export const Input = ({ label, hint, className, ...p }) => (
  <Field label={label} hint={hint}>
    <input className={cn(inputCls, className)} {...p} />
  </Field>
);
export const Textarea = ({ label, hint, className, ...p }) => (
  <Field label={label} hint={hint}>
    <textarea rows={4} className={cn(inputCls, className)} {...p} />
  </Field>
);
export const Select = ({ label, hint, className, children, ...p }) => (
  <Field label={label} hint={hint}>
    <select className={cn(inputCls, className)} {...p}>
      {children}
    </select>
  </Field>
);

export const Card = ({ className, children, ...p }) => (
  <div className={cn('rounded-xl border border-slate-200 bg-white shadow-sm', className)} {...p}>
    {children}
  </div>
);

export const Badge = ({ cls, children }) => (
  <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', cls)}>
    {children}
  </span>
);
export const StatusBadge = ({ status }) => <Badge cls={STATUS[status]?.cls}>{STATUS[status]?.label || status}</Badge>;
export const PriorityBadge = ({ priority }) => (
  <Badge cls={PRIORITY[priority]?.cls}>{PRIORITY[priority]?.label || priority}</Badge>
);
export const RoleBadge = ({ role }) => (
  <Badge cls="bg-indigo-50 text-indigo-700">{ROLE_LABEL[role] || role}</Badge>
);

/* ---------- States ---------- */

export function EmptyState({ title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <FiInbox className="mb-3 h-8 w-8 text-slate-400" />
      <p className="font-medium text-slate-900">{title}</p>
      {text && <p className="mt-1 text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center">
      <FiAlertCircle className="mb-2 h-7 w-7 text-red-500" />
      <p className="font-medium text-red-700">{message || 'Something went wrong'}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Pager({ meta, onPage }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
      <span>
        Page {meta.page} of {meta.totalPages} · {meta.total} total
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

export function Page({ title, subtitle, actions, children }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
      {(title || actions) && (
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
            {subtitle && <p className="mt-1 text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </motion.div>
  );
}

/* ---------- Modal ---------- */

export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            className={cn(
              'max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white p-6 shadow-xl',
              wide ? 'max-w-2xl' : 'max-w-md'
            )}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
              <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <FiX className="h-5 w-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Toasts ---------- */

const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  const toast = useCallback(
    Object.assign((m) => push(m, 'success'), {
      success: (m) => push(m, 'success'),
      error: (m) => push(m, 'error'),
    }),
    [push]
  );

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className={cn(
                'flex items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg',
                t.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-green-200 bg-green-50 text-green-700'
              )}
            >
              {t.type === 'error' ? (
                <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <FiCheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}