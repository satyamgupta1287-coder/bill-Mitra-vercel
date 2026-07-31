import { useState } from 'react';
import { useAuth } from 'zite-auth-sdk';
import { activateLicense } from 'zite-endpoints-sdk';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KeyRound, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function ActivateLicensePage({ onActivated }: { onActivated: () => void }) {
  const { user, logout } = useAuth();
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleActivate = async () => {
    if (!key.trim()) return;
    setError('');
    setLoading(true);
    try {
      await activateLicense({ licenseKey: key.trim() });
      setSuccess(true);
      setTimeout(onActivated, 1200);
    } catch (err: any) {
      setError(err?.message || 'Activation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="w-14 h-14 rounded-xl bg-primary mx-auto flex items-center justify-center">
          <KeyRound className="w-7 h-7 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Activate Your License</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter your license key to unlock all features</p>
        </div>

        {success ? (
          <div className="rounded-lg border border-border bg-emerald-500/10 p-6 space-y-2">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
            <p className="text-sm font-medium text-foreground">License activated successfully!</p>
            <p className="text-xs text-muted-foreground">Redirecting to dashboard...</p>
          </div>
        ) : (
          <div className="space-y-4 text-left">
            <div>
              <label className="text-sm font-medium text-foreground">License Key</label>
              <Input
                className="mt-1.5 font-mono tracking-wider text-center h-12"
                placeholder="BILLMITRA-XXXX-XXXX-XXXX"
                value={key}
                onChange={e => { setKey(e.target.value.toUpperCase()); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleActivate()}
                autoFocus
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}

            <Button className="w-full h-11" onClick={handleActivate} disabled={loading || !key.trim()}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</> : 'Activate License'}
            </Button>
          </div>
        )}

        <div className="rounded-lg border border-border bg-muted/50 p-4 text-left space-y-1">
          <p className="text-xs font-medium text-foreground">Don&apos;t have a license key?</p>
          <p className="text-xs text-muted-foreground">Contact your administrator or purchase a license to get started.</p>
        </div>

        <p className="text-xs text-muted-foreground">
          Logged in as {user?.email} ·{' '}
          <button onClick={() => logout()} className="underline hover:text-foreground transition-colors">Sign out</button>
        </p>
      </div>
    </div>
  );
}
