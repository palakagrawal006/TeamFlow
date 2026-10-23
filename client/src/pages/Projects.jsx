import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiSearch, FiUsers } from 'react-icons/fi';
import api, { errMsg } from '../api';
import { useAuth } from '../AuthContext';
import {
  Badge, Button, Card, EmptyState, ErrorState, FullSpinner, Input, Modal, Page, Pager,
  RoleBadge, Select, Textarea, useToast,
} from '../ui';

export default function Projects() {
  const { user } = useAuth();
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
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
      .get('/projects', { params: { page, limit: 12, status: status || undefined, q: q || undefined } })
      .then((r) => {
        setProjects(r.data.data);
        setMeta(r.data.meta);
      })
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, [page, status, q]);
  useEffect(load, [load]);

  const isAdmin = user.role === 'admin';

  return (
    <Page
      title="Projects"
      subtitle={isAdmin ? 'All projects in the workspace' : 'Projects you belong to'}
      actions={
        isAdmin && (
          <Button onClick={() => setShowNew(true)}>
            <FiPlus /> New project
          </Button>
        )
      }
    >
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative w-full sm:w-64">
          <FiSearch className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search projects"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {loading ? (
        <FullSpinner />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : projects.length === 0 ? (
        <EmptyState title="No projects found" text={isAdmin ? 'Create the first project to get started.' : 'You have not been added to any project yet.'} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => {
              const pct = p.taskCount ? Math.round((p.doneCount / p.taskCount) * 100) : 0;
              return (
                <Link key={p._id} to={`/projects/${p._id}/tasks`}>
                  <Card className="h-full p-5 transition hover:border-indigo-300 hover:shadow-md">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-slate-900">{p.name}</h3>
                      <Badge cls={p.status === 'archived' ? 'bg-slate-100 text-slate-600' : 'bg-green-100 text-green-700'}>
                        {p.status}
                      </Badge>
                    </div>
                    <p className="mb-4 line-clamp-2 min-h-10 text-sm text-slate-500">{p.description || 'No description'}</p>
                    <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>
                        {p.doneCount}/{p.taskCount} tasks done
                      </span>
                      <span className="flex items-center gap-1">
                        <FiUsers /> {p.memberCount}
                      </span>
                    </div>
                    {p.myRole && p.myRole !== 'admin' && (
                      <div className="mt-3">
                        <RoleBadge role={p.myRole} />
                      </div>
                    )}
                  </Card>
                </Link>
              );
            })}
          </div>
          <Pager meta={meta} onPage={setPage} />
        </>
      )}

      <NewProjectModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreated={() => {
          setShowNew(false);
          toast.success('Project created');
          load();
        }}
      />
    </Page>
  );
}

function NewProjectModal({ open, onClose, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', description: '', managerId: '' });
  const [managers, setManagers] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ name: '', description: '', managerId: '' });
    api
      .get('/users', { params: { limit: 100, active: true } })
      .then((r) => setManagers(r.data.data.filter((u) => ['admin', 'project_manager'].includes(u.role))))
      .catch((e) => toast.error(errMsg(e)));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/projects', { ...form, managerId: form.managerId || undefined });
      onCreated();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New project">
      <form onSubmit={submit} className="space-y-4">
        <Input label="Name" required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <Select label="Project manager" value={form.managerId} onChange={(e) => setForm({ ...form, managerId: e.target.value })}>
          <option value="">Assign later</option>
          {managers.map((m) => (
            <option key={m._id} value={m._id}>
              {m.name} ({m.email})
            </option>
          ))}
        </Select>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}