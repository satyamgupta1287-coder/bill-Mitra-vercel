import { useEffect, useState, useCallback } from 'react';
import { getLicenses, generateLicenses, updateLicenseStatus, GetLicensesOutputType } from 'zite-endpoints-sdk';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, Search, Copy, KeyRound, ShieldOff, Ban, Check } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

type License = GetLicensesOutputType['licenses'][0];
type Stats = GetLicensesOutputType['stats'];

export default function LicensesPage() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, available: 0, expired: 0, disabled: 0, revoked: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [genOpen, setGenOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: 'disable' | 'revoke'; key: string } | null>(null);

  const fetchData = useCallback(async (s?: string) => {
    try {
      const data = await getLicenses({
        search: s ?? search,
        statusFilter,
        planFilter,
      });
      setLicenses(data.licenses);
      setStats(data.stats);
    } catch { toast.error('Failed to load licenses'); }
    finally { setLoading(false); }
  }, [statusFilter, planFilter, search]);

  useEffect(() => { fetchData(); }, [statusFilter, planFilter]);

  const debouncedSearch = useDebouncedCallback((val: string) => fetchData(val), 400);

  const handleAction = async () => {
    if (!confirmAction) return;
    try {
      await updateLicenseStatus({ licenseId: confirmAction.id, action: confirmAction.action });
      toast.success(`License ${confirmAction.action === 'disable' ? 'disabled' : 'revoked'}`);
      setConfirmAction(null);
      fetchData();
    } catch (e: any) { toast.error(e?.message || 'Action failed'); }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('License key copied');
  };

  if (loading) return <LicensesSkeleton />;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">License Management</h1>
          <p className="text-sm text-muted-foreground">Generate, manage, and track all license keys</p>
        </div>
        <Button onClick={() => setGenOpen(true)}><Plus className="w-4 h-4 mr-2" />Generate License</Button>
      </div>

      <StatsRow stats={stats} />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by key or user email..."
            value={search}
            onChange={e => { setSearch(e.target.value); debouncedSearch(e.target.value); }}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Available">Available</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Expired">Expired</SelectItem>
            <SelectItem value="Disabled">Disabled</SelectItem>
            <SelectItem value="Revoked">Revoked</SelectItem>
          </SelectContent>
        </Select>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plans</SelectItem>
            <SelectItem value="Lifetime">Lifetime</SelectItem>
            <SelectItem value="1 Year">1 Year</SelectItem>
            <SelectItem value="6 Month">6 Month</SelectItem>
            <SelectItem value="Trial">Trial</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">LICENSE KEY</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">PLAN</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">STATUS</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">ASSIGNED TO</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">ACTIVATED</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">EXPIRY</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {licenses.length === 0 && (
              <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No licenses found</td></tr>
            )}
            {licenses.map(lic => (
              <LicenseRow key={lic.id} lic={lic} onCopy={copyKey} onAction={(action) => setConfirmAction({ id: lic.id, action, key: lic.licenseKey })} />
            ))}
          </tbody>
        </table>
      </div>

      <GenerateDialog open={genOpen} onClose={() => setGenOpen(false)} onGenerated={() => { setGenOpen(false); fetchData(); }} />

      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.action === 'disable' ? 'Disable License' : 'Revoke License'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.action === 'disable'
                ? 'This will disable the license key. It cannot be used for new activations.'
                : 'This will revoke the license and unbind it from the user. They will lose access immediately.'}
              <br /><code className="text-xs mt-2 block">{confirmAction?.key}</code>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAction} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {confirmAction?.action === 'disable' ? 'Disable' : 'Revoke'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatsRow({ stats }: { stats: Stats }) {
  const items = [
    { label: 'Total Licenses', value: stats.total },
    { label: 'Active', value: stats.active },
    { label: 'Available', value: stats.available },
    { label: 'Expired', value: stats.expired },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {items.map(s => (
        <Card key={s.label}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  Available: 'bg-muted text-muted-foreground',
  Active: 'bg-emerald-500/10 text-emerald-600',
  Expired: 'bg-destructive/10 text-destructive',
  Disabled: 'bg-amber-500/10 text-amber-600',
  Revoked: 'bg-muted text-muted-foreground',
};

const PLAN_COLORS: Record<string, string> = {
  Lifetime: 'bg-primary/10 text-primary',
  '1 Year': 'bg-blue-500/10 text-blue-600',
  '6 Month': 'bg-teal-500/10 text-teal-600',
  Trial: 'bg-muted text-foreground',
};

function formatDt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function LicenseRow({ lic, onCopy, onAction }: { lic: License; onCopy: (k: string) => void; onAction: (a: 'disable' | 'revoke') => void }) {
  const isExpired = lic.status === 'Expired' || lic.status === 'Revoked';
  return (
    <tr className="border-t border-border hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3 font-mono text-xs">{lic.licenseKey}</td>
      <td className="px-4 py-3">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_COLORS[lic.plan] || ''}`}>{lic.plan}</span>
      </td>
      <td className="px-4 py-3">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[lic.status] || ''}`}>{lic.status}</span>
      </td>
      <td className="px-4 py-3 text-muted-foreground text-xs">{lic.assignedToEmail || '—'}</td>
      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDt(lic.activationDate)}</td>
      <td className={`px-4 py-3 text-xs ${lic.plan === 'Lifetime' && lic.status === 'Active' ? 'text-muted-foreground' : isExpired ? 'text-destructive' : 'text-muted-foreground'}`}>
        {lic.plan === 'Lifetime' && lic.status === 'Active' ? 'Never' : formatDt(lic.expiryDate)}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onCopy(lic.licenseKey)}>
            <Copy className="w-3 h-3 mr-1" />Copy
          </Button>
          {(lic.status === 'Available' || lic.status === 'Active') && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={() => onAction(lic.status === 'Active' ? 'revoke' : 'disable')}>
              {lic.status === 'Active' ? <><ShieldOff className="w-3 h-3 mr-1" />Revoke</> : <><Ban className="w-3 h-3 mr-1" />Disable</>}
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

function GenerateDialog({ open, onClose, onGenerated }: { open: boolean; onClose: () => void; onGenerated: () => void }) {
  const [plan, setPlan] = useState<'Lifetime' | '1 Year' | '6 Month' | 'Trial'>('1 Year');
  const [qty, setQty] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [generatedKeys, setGeneratedKeys] = useState<string[]>([]);
  const [copiedAll, setCopiedAll] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { keys } = await generateLicenses({ plan, quantity: qty });
      setGeneratedKeys(keys);
      toast.success(`Generated ${keys.length} license key${keys.length > 1 ? 's' : ''}`);
    } catch (e: any) { toast.error(e?.message || 'Generation failed'); }
    finally { setGenerating(false); }
  };

  const copyAll = () => {
    navigator.clipboard.writeText(generatedKeys.join('\n'));
    setCopiedAll(true);
    toast.success('All keys copied');
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleClose = () => {
    if (generatedKeys.length > 0) onGenerated();
    else onClose();
    setGeneratedKeys([]);
    setCopiedAll(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="w-5 h-5" />Generate License Keys</DialogTitle>
        </DialogHeader>

        {generatedKeys.length === 0 ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Plan Type</label>
              <Select value={plan} onValueChange={v => setPlan(v as any)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Lifetime">Lifetime</SelectItem>
                  <SelectItem value="1 Year">1 Year</SelectItem>
                  <SelectItem value="6 Month">6 Month</SelectItem>
                  <SelectItem value="Trial">Trial (15 days)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Quantity (1–25)</label>
              <Input type="number" min={1} max={25} value={qty} onChange={e => setQty(Math.min(25, Math.max(1, Number(e.target.value))))} className="mt-1" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? 'Generating...' : `Generate ${qty} Key${qty > 1 ? 's' : ''}`}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Generated <strong>{generatedKeys.length}</strong> {plan} key{generatedKeys.length > 1 ? 's' : ''}:
            </p>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-border bg-muted/50 p-3 space-y-1">
              {generatedKeys.map(k => (
                <div key={k} className="flex items-center justify-between gap-2 py-1">
                  <code className="text-xs font-mono">{k}</code>
                  <Button variant="ghost" size="sm" className="h-6 px-1.5" onClick={() => { navigator.clipboard.writeText(k); toast.success('Copied'); }}>
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={copyAll}>
                {copiedAll ? <><Check className="w-4 h-4 mr-1" />Copied!</> : <><Copy className="w-4 h-4 mr-1" />Copy All</>}
              </Button>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LicensesSkeleton() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}
