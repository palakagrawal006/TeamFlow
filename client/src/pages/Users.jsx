import { useCallback, useEffect, useState } from 'react';
import { FiEdit2, FiPlus, FiSearch } from 'react-icons/fi';
import api, { errMsg } from '../api';
import { useAuth } from '../AuthContext';
import {
  Badge, Button, Card, EmptyState, ErrorState, FullSpinner, Input, Modal, Page, Pager,
  RoleBadge, Select, useToast, ROLE_LABEL,
} from '../ui';

const ROLES = ['admin', 'project_manager', 'team_member', 'viewer'];

export default function Users() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [role, setRole] = useState('');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | user

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
      .get('/users', { params: { page, limit: 10, role: role || undefined, q: q || undefined } })
      .then((r) => {
        setUsers(r.data.data);
        setMeta(r.data.meta);
      })
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, [page, role, q]);
  useEffect(load, [load]);

  const toggleActive = async (u) => {
    try {
      await api.post(`/users/${u._id}/${u.isActive ? 'deactivate' : 'activate'}`);
      toast.success(u.isActive ? 'User deactivated' : 'User activated');
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <Page
      title="Users"
      subtitle="Create accounts, change roles, and deactivate access"
      actions={
        <Button onClick={() => setEditing('new')}>
          <FiPlus /> New user
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative w-full sm:w-64">
          <FiSearch className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search name or email"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <FullSpinner />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : users.length === 0 ? (
        <EmptyState title="No users found" />
      ) : (
        <>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge cls={u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {u.isActive ? 'Active' : 'Deactivated'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setEditing(u)}>
                          <FiEdit2 /> Edit
                        </Button>
                        {u._id !== me._id && (
                          <Button variant="secondary" onClick={() => toggleActive(u)}>
                            {u.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Pager meta={meta} onPage={setPage} />
        </>
      )}

      <UserModal
        target={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          toast.success('User saved');
          load();
        }}
      />
    </Page>
  );
}

function UserModal({ target, onClose, onSaved }) {
  const toast = useToast();
  const isNew = target === 'new';
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'team_member' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) return;
    setForm(
      isNew
        ? { name: '', email: '', password: '', role: 'team_member' }
        : { name: target.name, email: target.email, password: '', role: target.role }
    );
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isNew) {
        await api.post('/users', form);
      } else {
        const payload = { name: form.name, email: form.email, role: form.role };
        if (form.password) payload.password = form.password;
        await api.patch(`/users/${target._id}`, payload);
      }
      onSaved();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!target} onClose={onClose} title={isNew ? 'New user' : 'Edit user'}>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Name" required value={form.name} onChange={set('name')} />
        <Input label="Email" type="email" required value={form.email} onChange={set('email')} />
        <Input
          label={isNew ? 'Password' : 'New password'}
          type="password"
          required={isNew}
          minLength={6}
          hint={isNew ? 'At least 6 characters' : 'Leave blank to keep the current password'}
          value={form.password}
          onChange={set('password')}
        />
        <Select label="Role" value={form.role} onChange={set('role')}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </Select>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {isNew ? 'Create user' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}