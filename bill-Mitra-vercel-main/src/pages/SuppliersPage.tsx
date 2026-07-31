import { useEffect, useState, useCallback } from 'react';
import { getSuppliers, saveSupplier, deleteSupplier as deleteSupplierApi } from 'zite-endpoints-sdk';
import { useDebouncedCallback } from 'use-debounce';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, Search, Edit, Trash2, Phone, Mail, Truck } from 'lucide-react';
import { INDIAN_STATES, validateGstin } from '@/lib/utils';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback((s?: string) => {
    setLoading(true);
    getSuppliers({ search: s || undefined }).then(r => setSuppliers(r.suppliers)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  const debouncedSearch = useDebouncedCallback((val: string) => load(val), 400);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: any = {};
    fd.forEach((v, k) => { if (v) data[k] = v; });

    if (data.gstin && !validateGstin(data.gstin)) {
      toast.error('Invalid GSTIN format');
      return;
    }

    setSaving(true);
    try {
      if (editing?.id) data.id = editing.id;
      await saveSupplier(data);
      toast.success(editing ? 'Supplier updated' : 'Supplier added');
      setDialogOpen(false);
      setEditing(null);
      load(search);
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteSupplierApi({ id: deleteId });
      setSuppliers(s => s.filter(x => x.id !== deleteId));
      toast.success('Supplier deleted');
    } catch { toast.error('Failed to delete'); }
    setDeleteId(null);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Suppliers</h1>
          <p className="text-sm text-muted-foreground">{suppliers.length} suppliers — add your wholesale suppliers here</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="w-4 h-4 mr-2" />Add Supplier</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search suppliers..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); debouncedSearch(e.target.value); }} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : suppliers.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Truck className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
          <p>No suppliers found. Add your wholesale suppliers to start making purchase entries.</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map(s => (
            <Card key={s.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Truck className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{s.supplierName}</h3>
                      {s.gstin && <p className="text-xs text-muted-foreground font-mono mt-0.5">{s.gstin}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(s); setDialogOpen(true); }}><Edit className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(s.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {s.email && <p className="flex items-center gap-1.5"><Mail className="w-3 h-3" />{s.email}</p>}
                  {s.phone && <p className="flex items-center gap-1.5"><Phone className="w-3 h-3" />{s.phone}</p>}
                  {s.city && <p>{s.city}{s.state ? `, ${s.state}` : ''}</p>}
                  {s.dlNumber && <p>DL: {s.dlNumber}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) { setDialogOpen(false); setEditing(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Supplier Name *</Label><Input name="supplierName" required defaultValue={editing?.supplierName} /></div>
              <div><Label>GSTIN</Label><Input name="gstin" placeholder="22AAAAA0000A1Z5" defaultValue={editing?.gstin} /></div>
              <div><Label>Email</Label><Input name="email" type="email" defaultValue={editing?.email} /></div>
              <div><Label>Phone</Label><Input name="phone" defaultValue={editing?.phone} /></div>
              <div><Label>DL Number</Label><Input name="dlNumber" defaultValue={editing?.dlNumber} /></div>
            </div>
            <h4 className="text-sm font-semibold pt-2">Address</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2"><Textarea name="address" placeholder="Street address" rows={2} defaultValue={editing?.address} /></div>
              <div><Label>City</Label><Input name="city" defaultValue={editing?.city} /></div>
              <div>
                <Label>State</Label>
                <Select name="state" defaultValue={editing?.state}>
                  <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                  <SelectContent>{INDIAN_STATES.map(s => <SelectItem key={s.code} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>State Code</Label><Input name="stateCode" defaultValue={editing?.stateCode} /></div>
              <div><Label>Pincode</Label><Input name="pincode" defaultValue={editing?.pincode} /></div>
            </div>
            <DialogFooter><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Supplier'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Supplier?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
