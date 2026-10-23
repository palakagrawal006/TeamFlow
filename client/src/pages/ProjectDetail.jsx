import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, useParams } from 'react-router-dom';
import { FiArchive, FiEdit2, FiPlus, FiSearch, FiTrash2 } from 'react-icons/fi';
import api, { errMsg } from '../api';
import { useAuth } from '../AuthContext';
import {
  Badge, Button, Card, EmptyState, ErrorState, FullSpinner, Input, Modal, Page, Pager,
  PriorityBadge, RoleBadge, Select, StatusBadge, Textarea, cn, fmtDate, isOverdue, useToast,
  STATUS, PRIORITY,
} from '../ui';

export default function ProjectDetail({ tab }) {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .get(`/projects/${id}`)
      .then((r) => {
        setProject(r.data.data);
        setError('');
      })
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  if (loading) return <FullSpinner />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const isAdmin = user.role === 'admin';
  const isMgr = ['admin', 'manager'].includes(project.myRole);
  const archived = project.status === 'archived';

  const toggleArchive = async () => {
    setBusy(true);
    try {
      await api.post(`/projects/${id}/${archived ? 'unarchive' : 'archive'}`);
      toast.success(archived ? 'Project restored' : 'Project archived');
      load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const tabCls = ({ isActive }) =>
    cn(
      'border-b-2 px-4 py-2 text-sm font-medium',
      isActive ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'
    );

  return (
    <Page>
      <Link to="/projects" className="mb-3 inline-block text-sm text-indigo-600 hover:underline">
        ← All projects
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            <Badge cls={archived ? 'bg-slate-100 text-slate-600' : 'bg-green-100 text-green-700'}>{project.status}</Badge>
          </div>
          <p className="mt-1 max-w-2xl text-slate-500">{project.description || 'No description'}</p>
        </div>
        <div className="flex gap-2">
          {isMgr && !archived && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <FiEdit2 /> Edit
            </Button>
          )}
          {isAdmin && (
            <Button variant="secondary" loading={busy} onClick={toggleArchive}>
              <FiArchive /> {archived ? 'Restore' : 'Archive'}
            </Button>
          )}
        </div>
      </div>
      {archived && (
        <p className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
          This project is archived and read-only.
        </p>
      )}

      <div className="mb-5 flex border-b border-slate-200">
        <NavLink to={`/projects/${id}/tasks`} className={tabCls}>
          Tasks
        </NavLink>
        <NavLink to={`/projects/${id}/team`} className={tabCls}>
          Team ({project.members.length})
        </NavLink>
      </div>

      {tab === 'team' ? (
        <TeamTab project={project} isMgr={isMgr && !archived} isAdmin={isAdmin} onChange={load} />
      ) : (
        <TasksTab project={project} canCreate={isMgr && !archived} />
      )}

      <EditProjectModal
        open={editing}
        project={project}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          toast.success('Project updated');
          load();
        }}
      />
    </Page>
  );
}

/* ---------------- Edit project ---------------- */

function EditProjectModal({ open, project, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setForm({ name: project.name, description: project.description || '' });
  }, [open, project]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/projects/${project._id}`, form);
      onSaved();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit project">
      <form onSubmit={submit} className="space-y-4">
        <Input label="Name" required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------- Tasks tab ---------------- */

function TasksTab({ project, canCreate }) {
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: '', priority: '', assignee: '' });
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api
      .get(`/projects/${project._id}/tasks`, {
        params: {
          page,
          limit: 10,
          status: filters.status || undefined,
          priority: filters.priority || undefined,
          assignee: filters.assignee || undefined,
          q: q || undefined,
        },
      })
      .then((r) => {
        setTasks(r.data.data);
        setMeta(r.data.meta);
      })
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, [project._id, page, filters, q]);
  useEffect(load, [load]);

  const setFilter = (key) => (e) => {
    setFilters({ ...filters, [key]: e.target.value });
    setPage(1);
  };
  const selectCls = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-56">
          <FiSearch className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search tasks"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <select className={selectCls} value={filters.status} onChange={setFilter('status')}>
          <option value="">All statuses</option>
          {Object.entries(STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <select className={selectCls} value={filters.priority} onChange={setFilter('priority')}>
          <option value="">All priorities</option>
          {Object.entries(PRIORITY).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <select className={selectCls} value={filters.assignee} onChange={setFilter('assignee')}>
          <option value="">Anyone</option>
          <option value="me">Assigned to me</option>
          <option value="none">Unassigned</option>
          {project.members.map((m) => (
            <option key={m.user._id} value={m.user._id}>
              {m.user.name}
            </option>
          ))}
        </select>
        {canCreate && (
          <Button className="ml-auto" onClick={() => setShowNew(true)}>
            <FiPlus /> New task
          </Button>
        )}
      </div>

      {loading ? (
        <FullSpinner />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : tasks.length === 0 ? (
        <EmptyState title="No tasks found" text="Try changing the filters, or create a new task." />
      ) : (
        <>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Task</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Assignee</th>
                  <th className="px-4 py-3">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.map((t) => (
                  <tr key={t._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link to={`/tasks/${t._id}`} className="font-medium text-slate-900 hover:text-indigo-600">
                        {t.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={t.priority} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">{t.assignee?.name || 'Unassigned'}</td>
                    <td className={cn('px-4 py-3', isOverdue(t) ? 'font-medium text-red-600' : 'text-slate-600')}>
                      {fmtDate(t.dueDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Pager meta={meta} onPage={setPage} />
        </>
      )}

      <NewTaskModal
        open={showNew}
        project={project}
        onClose={() => setShowNew(false)}
        onCreated={() => {
          setShowNew(false);
          toast.success('Task created');
          load();
        }}
      />
    </>
  );
}

function NewTaskModal({ open, project, onClose, onCreated }) {
  const toast = useToast();
  const blank = { title: '', description: '', priority: 'medium', status: 'todo', assignee: '', dueDate: '' };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setForm(blank);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/projects/${project._id}/tasks`, {
        ...form,
        assignee: form.assignee || null,
        dueDate: form.dueDate || null,
      });
      onCreated();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New task">
      <form onSubmit={submit} className="space-y-4">
        <Input label="Title" required maxLength={200} value={form.title} onChange={set('title')} />
        <Textarea label="Description" value={form.description} onChange={set('description')} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Status" value={form.status} onChange={set('status')}>
            {Object.entries(STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
          <Select label="Priority" value={form.priority} onChange={set('priority')}>
            {Object.entries(PRIORITY).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
          <Select label="Assignee" value={form.assignee} onChange={set('assignee')}>
            <option value="">Unassigned</option>
            {project.members.map((m) => (
              <option key={m.user._id} value={m.user._id}>
                {m.user.name}
              </option>
            ))}
          </Select>
          <Input label="Due date" type="date" value={form.dueDate} onChange={set('dueDate')} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Create task
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------- Team tab ---------------- */

function TeamTab({ project, isMgr, isAdmin, onChange }) {
  const toast = useToast();
  const [showAdd, setShowAdd] = useState(false);

  const changeRole = async (userId, projectRole) => {
    try {
      await api.patch(`/projects/${project._id}/members/${userId}`, { projectRole });
      toast.success('Role updated');
      onChange();
    } catch (e) {
      toast.error(errMsg(e));
      onChange();
    }
  };

  const remove = async (m) => {
    if (!window.confirm(`Remove ${m.user.name} from this project? Their tasks will become unassigned.`)) return;
    try {
      await api.delete(`/projects/${project._id}/members/${m.user._id}`);
      toast.success('Member removed');
      onChange();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <>
      {isMgr && (
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setShowAdd(true)}>
            <FiPlus /> Add member
          </Button>
        </div>
      )}
      {project.members.length === 0 ? (
        <EmptyState title="No team members yet" />
      ) : (
        <Card className="divide-y divide-slate-100">
          {project.members.map((m) => {
            const lockRole = !isMgr || (m.role === 'manager' && !isAdmin);
            return (
              <div key={m.user._id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{m.user.name}</p>
                  <p className="text-xs text-slate-500">
                    {m.user.email} · <RoleBadge role={m.user.role} />
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {lockRole ? (
                    <RoleBadge role={m.role} />
                  ) : (
                    <select
                      value={m.role}
                      onChange={(e) => changeRole(m.user._id, e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                    >
                      <option value="manager" disabled={!isAdmin}>
                        Manager
                      </option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  )}
                  {isMgr && !(m.role === 'manager' && !isAdmin) && (
                    <button
                      onClick={() => remove(m)}
                      title="Remove"
                      className="rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <FiTrash2 />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}
      <AddMemberModal
        open={showAdd}
        project={project}
        isAdmin={isAdmin}
        onClose={() => setShowAdd(false)}
        onAdded={() => {
          setShowAdd(false);
          toast.success('Member added');
          onChange();
        }}
      />
    </>
  );
}

function AddMemberModal({ open, project, isAdmin, onClose, onAdded }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [projectRole, setProjectRole] = useState('member');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setQ('');
      setSelected(null);
      setProjectRole('member');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      api
        .get('/users/lookup', { params: { q: q || undefined } })
        .then((r) => setResults(r.data.data))
        .catch((e) => toast.error(errMsg(e)));
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const memberIds = new Set(project.members.map((m) => m.user._id));
  const available = results.filter((u) => !memberIds.has(u._id));

  const submit = async () => {
    if (!selected) return toast.error('Pick a user first');
    setSaving(true);
    try {
      await api.post(`/projects/${project._id}/members`, { userId: selected._id, projectRole });
      onAdded();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add team member">
      <div className="space-y-4">
        <Input label="Search users" placeholder="Name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200">
          {available.length === 0 ? (
            <p className="p-3 text-sm text-slate-500">No users available</p>
          ) : (
            available.map((u) => (
              <button
                key={u._id}
                onClick={() => setSelected(u)}
                className={cn(
                  'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50',
                  selected?._id === u._id && 'bg-indigo-50'
                )}
              >
                <span>
                  {u.name} <span className="text-xs text-slate-500">{u.email}</span>
                </span>
                <RoleBadge role={u.role} />
              </button>
            ))
          )}
        </div>
        <Select label="Project role" value={projectRole} onChange={(e) => setProjectRole(e.target.value)}>
          {isAdmin && <option value="manager">Manager</option>}
          <option value="member">Member</option>
          <option value="viewer">Viewer</option>
        </Select>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={submit}>
            Add to project
          </Button>
        </div>
      </div>
    </Modal>
  );
}