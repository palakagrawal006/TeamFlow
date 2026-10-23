import { useState } from 'react';
import api, { errMsg } from '../api';
import { useAuth } from '../AuthContext';
import { Button, Card, Input, Page, RoleBadge, useToast } from '../ui';

export default function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [savingName, setSavingName] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const saveName = async (e) => {
    e.preventDefault();
    setSavingName(true);
    try {
      const { data } = await api.patch('/auth/me', { name });
      setUser(data.data);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSavingName(false);
    }
  };

  const savePw = async (e) => {
    e.preventDefault();
    setSavingPw(true);
    try {
      await api.patch('/auth/me', pw);
      setPw({ currentPassword: '', newPassword: '' });
      toast.success('Password changed');
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <Page title="Profile" subtitle="Your account details">
      <div className="grid max-w-3xl gap-6 md:grid-cols-2">
        <Card className="p-5">
          <form onSubmit={saveName} className="space-y-4">
            <h2 className="font-semibold">Details</h2>
            <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="Email" value={user.email} disabled />
            <div>
              <span className="mb-1 block text-sm font-medium text-slate-700">Role</span>
              <RoleBadge role={user.role} />
            </div>
            <Button type="submit" loading={savingName} disabled={name.trim() === user.name}>
              Save
            </Button>
          </form>
        </Card>
        <Card className="p-5">
          <form onSubmit={savePw} className="space-y-4">
            <h2 className="font-semibold">Change password</h2>
            <Input
              label="Current password"
              type="password"
              required
              value={pw.currentPassword}
              onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })}
            />
            <Input
              label="New password"
              type="password"
              required
              minLength={6}
              value={pw.newPassword}
              onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
            />
            <Button type="submit" loading={savingPw}>
              Update password
            </Button>
          </form>
        </Card>
      </div>
    </Page>
  );
}