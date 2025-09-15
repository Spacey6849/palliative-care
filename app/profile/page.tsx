"use client";
import { useUser } from '@/components/user-context';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';

export default function ProfilePage() {
  const { user, loading, refresh, role } = useUser();
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: '',
    panchayat_name: '',
    location: '',
    phone: ''
  });
  const [wells, setWells] = useState<any[]>([]);
  const [wellsLoading, setWellsLoading] = useState(false);
  const [wellMessage, setWellMessage] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load initial form values from user metadata
  useEffect(() => {
    if (user) {
      setForm({
  full_name: (user as any)?.full_name || '',
  panchayat_name: (user as any)?.panchayat_name || '',
  location: (user as any)?.location || '',
  phone: (user as any)?.phone || ''
      });
    }
  }, [user]);

  useEffect(() => { if (!loading && !user) router.replace('/login'); }, [loading, user, router]);
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const save = useCallback(async () => {
    if (!user) return;
    setSaving(true); setMessage(null);
    const normalizedPhone = form.phone.replace(/[\s\-()]/g, '');
    try {
      const resp = await fetch('/api/profile/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, phone: normalizedPhone }) });
      if (!resp.ok) {
        const j = await resp.json().catch(()=>({error:'Failed'}));
        setMessage('Failed to save: ' + (j.error || 'Unknown error'));
      } else {
        setMessage('Profile updated');
        await refresh();
        setEditing(false);
      }
    } catch (e:any) {
      setMessage('Save error: ' + (e?.message || 'network'));
    } finally {
      setSaving(false);
    }
  }, [form, user, refresh]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setWellsLoading(true);
      try {
        const r = await fetch('/api/wells');
        const j = await r.json();
        setWells(j.wells || []);
      } catch {
        setWellMessage('Failed to load wells');
      } finally {
        setWellsLoading(false);
      }
    };
    load();
  }, [user]);

  const startRename = (w: any) => { setRenamingId(w.id); setRenameValue(w.name); };
  const cancelRename = () => { setRenamingId(null); setRenameValue(''); };
  const submitRename = async (id: string) => {
    if (!renameValue.trim()) return;
    setWellMessage(null);
    try {
      const resp = await fetch(`/api/wells/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: renameValue.trim() }) });
      if (!resp.ok) throw new Error();
      setWells(w => w.map(x => x.id === id ? { ...x, name: renameValue.trim() } : x));
      setWellMessage('Well renamed');
      cancelRename();
    } catch {
      setWellMessage('Rename failed');
    }
  };
  const submitDelete = async (id: string) => {
    if (!confirm('Delete this well? This cannot be undone.')) return;
    setDeletingId(id);
    setWellMessage(null);
    try {
      const resp = await fetch(`/api/wells/${id}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error();
      setWells(w => w.filter(x => x.id !== id));
      setWellMessage('Well deleted');
    } catch {
      setWellMessage('Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div className="p-10 text-sm text-muted-foreground">Loading profile...</div>;
  if (!user) return null;

  const Field = ({ label, name, placeholder, readOnly=false }: { label: string; name: keyof typeof form | 'email' | 'user_id'; placeholder?: string; readOnly?: boolean }) => {
    if (name === 'email' || name === 'user_id') {
      const value = name === 'email' ? user.email : user.id;
      return (
        <div className="group">
          <label className="text-xs font-medium uppercase tracking-wide ${isDark ? 'text-muted-foreground' : 'text-gray-500'}">{label}</label>
          <div className={`mt-1 flex items-center rounded-xl border px-4 py-2.5 text-sm overflow-hidden ${isDark ? 'border-white/15 bg-white/5 text-white/90' : 'border-gray-200 bg-white text-gray-800'}`}> 
            <span className="truncate">{value}</span>
          </div>
        </div>
      );
    }
    const value = form[name];
    return (
      <div className="group">
        <label className={`text-xs font-medium uppercase tracking-wide ${isDark ? 'text-muted-foreground' : 'text-gray-500'}`}>{label}</label>
        <input
          name={name}
          value={value}
          onChange={onChange}
          disabled={!editing || readOnly}
          placeholder={placeholder}
          className={`mt-1 w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition disabled:opacity-70 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400/50 ${isDark ? 'bg-white/5 border-white/15 text-white placeholder-white/30' : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400'} ${editing && !readOnly ? (isDark ? 'hover:border-white/30' : 'hover:border-gray-300') : ''}`}
        />
      </div>
    );
  };

  return (
    <div className={`min-h-screen w-full relative overflow-hidden ${isDark ? '' : 'bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50'}`}>
      {isDark && (
        <>
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-sky-950 via-emerald-950 to-slate-950" />
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-60 [mask-image:radial-gradient(circle_at_30%_20%,white,transparent_70%)]">
            <div className="absolute top-[-20%] left-[-10%] w-[55vw] h-[55vw] bg-cyan-500/10 blur-3xl rounded-full" />
            <div className="absolute bottom-[-25%] right-[-15%] w-[60vw] h-[60vw] bg-emerald-600/10 blur-3xl rounded-full" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70vw] h-[70vw] bg-blue-700/5 blur-3xl rounded-full" />
          </div>
        </>
      )}
      <div className="relative max-w-5xl mx-auto px-6 py-24">
      <div className="mb-10 flex flex-col sm:flex-row sm:items-end gap-6">
        <div>
          <h1 className={`text-4xl font-bold tracking-tight ${isDark ? 'bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60' : 'text-gray-900'}`}>Your Profile</h1>
          <p className={`mt-2 text-sm ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Manage your account & panchayat information.</p>
        </div>
        <div className="flex gap-3 ml-auto">
          {!editing && (
            <button onClick={() => setEditing(true)} className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium border shadow transition ${isDark ? 'bg-white/15 hover:bg-white/25 active:bg-white/30 text-white/90 hover:text-white border-white/20 shadow-black/20' : 'bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 hover:text-gray-900 border-gray-200 shadow-gray-200'}`}> 
              Edit Profile
            </button>
          )}
          {editing && (
            <>
              <button disabled={saving} onClick={() => setEditing(false)} className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition disabled:opacity-50 border ${isDark ? 'bg-white/10 hover:bg-white/20 text-white/80 border-white/15' : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-200'}`}>Cancel</button>
              <button disabled={saving} onClick={save} className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition disabled:opacity-50 ${isDark ? 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-lg shadow-blue-900/30' : 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-lg shadow-blue-500/30'}`}>{saving ? 'Saving...' : 'Save Changes'}</button>
            </>
          )}
        </div>
      </div>
      <div className="grid gap-8 lg:grid-cols-3">
        <motion.div layout className="lg:col-span-2 space-y-8">
          <div className={`rounded-3xl border backdrop-blur-xl p-8 shadow-xl relative overflow-hidden ${isDark ? 'border-white/15 bg-white/5 shadow-black/40' : 'border-gray-200 bg-white shadow-gray-200/60'}`}>
            {isDark && (
              <div className="absolute inset-0 pointer-events-none [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]">
                <div className="absolute -top-40 -right-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-44 -left-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
              </div>
            )}
            <h2 className={`text-xl font-semibold mb-6 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Account Details {role && <span className={`text-[11px] font-medium px-2 py-1 rounded-full uppercase border ${isDark ? 'bg-white/10 border-white/20 text-white/70' : 'bg-gray-100 border-gray-200 text-gray-600'}`}>{role}</span>}</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="Email" name="email" />
              <Field label="User ID" name="user_id" />
              <Field label="Full Name" name="full_name" placeholder="Your name" />
              <Field label="Phone" name="phone" placeholder="Phone number" />
              <Field label="Panchayat Name" name="panchayat_name" placeholder="Panchayat" />
              <Field label="Location" name="location" placeholder="District / State" />
            </div>
            <AnimatePresence>
              {message && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className={`mt-6 text-sm font-medium ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`}
                >{message}</motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className={`rounded-3xl border p-8 ${isDark ? 'border-white/10 bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl' : 'border-gray-200 bg-white'}`}>
            <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Security</h2>
            <p className={`text-xs mb-4 ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Password resets & multi-factor authentication will appear here in a future update.</p>
            <button className={`text-xs font-medium transition underline-offset-4 hover:underline ${isDark ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-500'}`} disabled>Reset Password (coming soon)</button>
          </div>
          <div className={`rounded-3xl border p-8 ${isDark ? 'border-white/10 bg-white/5 backdrop-blur-xl' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Registered Wells</h2>
              <button onClick={() => {
                // refresh wells
                (async ()=>{
                  setWellsLoading(true); setWellMessage(null);
                  try { const r = await fetch('/api/wells'); const j = await r.json(); setWells(j.wells||[]);} catch { setWellMessage('Reload failed'); } finally { setWellsLoading(false);} })();
              }} className={`text-xs font-medium underline-offset-4 hover:underline ${isDark ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-500'}`}>Reload</button>
            </div>
            {wellsLoading && <div className={`text-xs mb-4 ${isDark ? 'text-white/60' : 'text-gray-500'}`}>Loading wells...</div>}
            {wellMessage && <div className={`text-xs mb-4 font-medium ${/failed/i.test(wellMessage) ? (isDark ? 'text-red-300' : 'text-red-600') : (isDark ? 'text-emerald-300' : 'text-emerald-600')}`}>{wellMessage}</div>}
            {(!wellsLoading && wells.length === 0) && <div className={`text-xs ${isDark ? 'text-white/50' : 'text-gray-500'}`}>No wells registered yet.</div>}
            <ul className="space-y-4">
              {wells.map(w => (
                <li key={w.id} className={`group rounded-xl border px-4 py-3 flex items-center gap-4 ${isDark ? 'border-white/15 bg-white/5' : 'border-gray-200 bg-gray-50'} transition`}> 
                  <div className="flex-1 min-w-0">
                    {renamingId === w.id ? (
                      <input value={renameValue} onChange={e=>setRenameValue(e.target.value)} className={`w-full rounded-lg px-2 py-1 text-sm outline-none border ${isDark ? 'bg-white/10 border-white/20 text-white' : 'bg-white border-gray-300 text-gray-800'} focus:ring-2 focus:ring-blue-400/40`} />
                    ) : (
                      <div className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-800'}`}>{w.name}</div>
                    )}
                    <div className={`mt-0.5 text-[11px] flex flex-wrap gap-2 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                      <span>ID: {w.id}</span>
                      {w.panchayat_name && <span>Panchayat: {w.panchayat_name}</span>}
                      <span>Lat: {Number(w.lat).toFixed(4)}</span>
                      <span>Lng: {Number(w.lng).toFixed(4)}</span>
                    </div>
                  </div>
                  {renamingId === w.id ? (
                    <div className="flex items-center gap-2">
                      <button onClick={()=>submitRename(w.id)} className={`px-3 py-1 rounded-lg text-xs font-medium ${isDark ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>Save</button>
                      <button onClick={cancelRename} className={`px-3 py-1 rounded-lg text-xs font-medium ${isDark ? 'bg-white/10 hover:bg-white/20 text-white/80' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={()=>startRename(w)} className={`px-3 py-1 rounded-lg text-xs font-medium ${isDark ? 'bg-white/10 hover:bg-white/20 text-white/80' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>Rename</button>
                      <button disabled={deletingId===w.id} onClick={()=>submitDelete(w.id)} className={`px-3 py-1 rounded-lg text-xs font-medium ${isDark ? 'bg-red-600/80 hover:bg-red-600 text-white' : 'bg-red-600 hover:bg-red-500 text-white'} disabled:opacity-50`}>{deletingId===w.id?'Deleting...':'Delete'}</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
        <motion.div layout className="space-y-8">
            <div className={`rounded-3xl border p-6 ${isDark ? 'border-white/15 bg-white/5 backdrop-blur-xl' : 'border-gray-200 bg-white'}`}>
              <h3 className={`text-sm font-semibold tracking-wide uppercase mb-4 ${isDark ? 'text-white/70' : 'text-gray-500'}`}>At a Glance</h3>
              <ul className={`space-y-3 text-[13px] ${isDark ? 'text-white/70' : 'text-gray-600'}`}>
                <li className="flex justify-between"><span>Role</span><span className={`font-medium ${isDark ? 'text-white/90' : 'text-gray-800'}`}>{role || '—'}</span></li>
                <li className="flex justify-between"><span>Wells Created</span><span className={`font-medium ${isDark ? 'text-white/90' : 'text-gray-800'}`}>—</span></li>
                <li className="flex justify-between"><span>Member Since</span><span className={`font-medium ${isDark ? 'text-white/90' : 'text-gray-800'}`}>{(user as any)?.created_at ? new Date((user as any).created_at).toLocaleDateString() : '—'}</span></li>
              </ul>
            </div>
            <div className={`rounded-3xl border p-6 ${isDark ? 'border-red-500/30 bg-red-950/30 backdrop-blur-xl' : 'border-red-200 bg-red-50'}`}>
              <h3 className={`text-sm font-semibold tracking-wide uppercase mb-3 ${isDark ? 'text-red-200/80' : 'text-red-600'}`}>Danger Zone</h3>
              <p className={`text-[12px] mb-4 ${isDark ? 'text-red-200/70' : 'text-red-600/80'}`}>Deleting your account will remove all associated wells. This action cannot be undone (feature coming soon).</p>
              <button disabled className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-medium disabled:opacity-50 ${isDark ? 'border-red-400/30 bg-red-500/20 text-red-200 hover:bg-red-500/25' : 'border-red-300 bg-red-100 text-red-600'}`}>Delete Account</button>
            </div>
        </motion.div>
      </div>
    </div>
  </div>
  );
}
