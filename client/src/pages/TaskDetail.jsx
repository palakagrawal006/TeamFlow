import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FiAlertTriangle, FiTrash2 } from 'react-icons/fi';
import api, { errMsg } from '../api';
import { useAuth } from '../AuthContext';
import {
  Button, Card, ErrorState, FullSpinner, Input, Modal, Page, Select, Textarea,
  fmtDate, useToast, STATUS, PRIORITY,
} from '../ui';

const FIELD_LABELS = {
  title: 'Title',
  description: 'Description',
  status: 'Status',
  priority: 'Priority',
  dueDate: 'Due date',
  assignee: 'Assignee',
};

const fromTask = (t) => ({
  title: t.title,
  description: t.description || '',
  status: t.status,
  priority: t.priority,
  dueDate: t.dueDate ? t.dueDate.slice(0, 10) : '',
  assignee: t.assignee?._id || '',
});

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [task, setTask] = useState(null);
  const [meta, setMeta] = useState(null);
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(null); // { current }

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/tasks/${id}`);
      setTask(data.data);
      setMeta(data.meta);
      setForm(fromTask(data.data));
      const pr = await api.get(`/projects/${data.data.project._id}/members`);
      setMembers(pr.data.data);
      setError('');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  if (loading) return <FullSpinner />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const perms = meta.permissions;
  const base = fromTask(task);

  const changedFields = () => {
    const out = {};
    for (const k of Object.keys(base)) {
      if (k === 'assignee' && !perms.canAssign) continue;
      if (form[k] !== base[k]) out[k] = form[k];
    }
    return out;
  };
  const dirty = Object.keys(changedFields()).length > 0;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    const changes = changedFields();
    if (!Object.keys(changes).length) return;
    if ('assignee' in changes && !changes.assignee) changes.assignee = null;
    setSaving(true);
    try {
      const { data } = await api.patch(`/tasks/${id}`, { ...changes, version: task.version });
      setTask(data.data);
      setForm(fromTask(data.data));
      toast.success(`Task saved (version ${data.data.version})`);
    } catch (e) {
      const err = e.response?.data?.error;
      if (e.response?.status === 409 && err?.code === 'VERSION_CONFLICT') {
        setConflict({ current: err.details.current });
      } else {
        toast.error(errMsg(e));
      }
    } finally {
      setSaving(false);
    }
  };

  const useLatestDiscardMine = () => {
    setTask(conflict.current);
    setForm(fromTask(conflict.current));
    setConflict(null);
    toast.success('Loaded the latest version');
  };

  const keepMineOnLatest = () => {
    setTask(conflict.current);
    setForm({ ...fromTask(conflict.current), ...form });
    setConflict(null);
    toast.success('Latest version loaded with your edits. Review and save again.');
  };

  const remove = async () => {
    if (!window.confirm('Delete this task and its comments?')) return;
    try {
      await api.delete(`/tasks/${id}`);
      toast.success('Task deleted');
      navigate(`/projects/${task.project._id}/tasks`);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const nameOf = (userId) => members.find((m) => m.user._id === userId)?.user.name || 'Unassigned';
  const showVal = (k, v) => {
    if (k === 'assignee') return nameOf(v);
    if (k === 'status') return STATUS[v]?.label || v;
    if (k === 'priority') return PRIORITY[v]?.label || v;
    if (k === 'dueDate') return v ? fmtDate(v) : '—';
    return v || '—';
  };

  const conflictRows = conflict
    ? Object.keys(FIELD_LABELS).filter((k) => {
        if (k === 'assignee' && !perms.canAssign) return false;
        return form[k] !== fromTask(conflict.current)[k] && form[k] !== base[k];
      })
    : [];
  const latestChangedRows = conflict
    ? Object.keys(FIELD_LABELS).filter((k) => fromTask(conflict.current)[k] !== base[k])
    : [];

  return (
    <Page>
      <Link to={`/projects/${task.project._id}/tasks`} className="mb-3 inline-block text-sm text-indigo-600 hover:underline">
        ← {task.project.name}
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-4 p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Task details</h1>
            <span className="text-xs text-slate-400">version {task.version}</span>
          </div>
          {!perms.canEdit && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              You have read-only access to this task.
            </p>
          )}
          <Input label="Title" value={form.title} onChange={set('title')} disabled={!perms.canEdit} maxLength={200} />
          <Textarea label="Description" value={form.description} onChange={set('description')} disabled={!perms.canEdit} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Status" value={form.status} onChange={set('status')} disabled={!perms.canEdit}>
              {Object.entries(STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
            <Select label="Priority" value={form.priority} onChange={set('priority')} disabled={!perms.canEdit}>
              {Object.entries(PRIORITY).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
            <Select label="Assignee" value={form.assignee} onChange={set('assignee')} disabled={!perms.canAssign}>
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.user._id} value={m.user._id}>
                  {m.user.name}
                </option>
              ))}
            </Select>
            <Input label="Due date" type="date" value={form.dueDate} onChange={set('dueDate')} disabled={!perms.canEdit} />
          </div>
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-slate-500">
              Created by {task.createdBy?.name} · Updated {fmtDate(task.updatedAt)}
            </p>
            <div className="flex gap-2">
              {perms.canDelete && (
                <Button variant="danger" onClick={remove}>
                  <FiTrash2 /> Delete
                </Button>
              )}
              {perms.canEdit && (
                <Button loading={saving} disabled={!dirty} onClick={save}>
                  Save changes
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Comments taskId={id} perms={perms} myRole={meta.myRole} user={user} />
      </div>

      <Modal open={!!conflict} onClose={() => setConflict(null)} title="This task was changed by someone else" wide>
        {conflict && (
          <div className="space-y-4">
            <div className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                You were editing version {task.version}, but the latest is version {conflict.current.version}. Your
                save was not applied, so nothing was overwritten.
              </span>
            </div>
            {conflictRows.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium">Fields where your edit differs from the latest:</p>
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-1">Field</th>
                      <th>Your edit</th>
                      <th>Latest</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conflictRows.map((k) => (
                      <tr key={k} className="border-t border-slate-100">
                        <td className="py-2 font-medium">{FIELD_LABELS[k]}</td>
                        <td className="pr-2 text-indigo-700">{showVal(k, form[k])}</td>
                        <td className="text-slate-700">{showVal(k, fromTask(conflict.current)[k])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {latestChangedRows.length > 0 && (
              <p className="text-xs text-slate-500">
                Changed by others since you opened it: {latestChangedRows.map((k) => FIELD_LABELS[k]).join(', ')}.
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={useLatestDiscardMine}>
                Discard mine, use latest
              </Button>
              <Button onClick={keepMineOnLatest}>Keep my edits on latest</Button>
            </div>
          </div>
        )}
      </Modal>
    </Page>
  );
}

function Comments({ taskId, perms, myRole, user }) {
  const toast = useToast();
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const load = useCallback(() => {
    api
      .get(`/tasks/${taskId}/comments`)
      .then((r) => setComments(r.data.data))
      .catch((e) => toast.error(errMsg(e)))
      .finally(() => setLoading(false));
  }, [taskId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(load, [load]);

  const post = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setPosting(true);
    try {
      const { data } = await api.post(`/tasks/${taskId}/comments`, { body });
      setComments([...comments, data.data]);
      setBody('');
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setPosting(false);
    }
  };

  const del = async (c) => {
    try {
      await api.delete(`/comments/${c._id}`);
      setComments(comments.filter((x) => x._id !== c._id));
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const canDelete = (c) => ['admin', 'manager'].includes(myRole) || (c.author?._id === user._id && myRole !== 'viewer');

  return (
    <Card className="flex flex-col p-5">
      <h2 className="mb-3 text-lg font-semibold">Comments ({comments.length})</h2>
      <div className="mb-4 max-h-96 flex-1 space-y-3 overflow-y-auto">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-slate-500">No comments yet.</p>
        ) : (
          comments.map((c) => (
            <div key={c._id} className="rounded-lg bg-slate-50 p-3">
              <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                <span className="font-medium text-slate-700">{c.author?.name}</span>
                <span className="flex items-center gap-2">
                  {fmtDate(c.createdAt)}
                  {canDelete(c) && (
                    <button onClick={() => del(c)} className="text-slate-400 hover:text-red-600" title="Delete comment">
                      <FiTrash2 />
                    </button>
                  )}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{c.body}</p>
            </div>
          ))
        )}
      </div>
      {perms.canComment ? (
        <form onSubmit={post} className="space-y-2">
          <Textarea placeholder="Write a comment…" rows={3} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
          <Button type="submit" loading={posting} disabled={!body.trim()} className="w-full">
            Add comment
          </Button>
        </form>
      ) : (
        <p className="text-xs text-slate-500">You cannot comment on this task.</p>
      )}
    </Card>
  );
}