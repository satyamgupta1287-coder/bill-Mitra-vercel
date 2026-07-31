import { useEffect, useState, useCallback } from 'react';
import { getCustomers, saveCustomer, deleteCustomer as deleteCustomerApi } from 'zite-endpoints-sdk';
import { useDebouncedCallback } from 'use-debounce';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Edit, Trash2, Phone, Mail } from 'lucide-react';
import { formatCurrency, INDIAN_STATES, validateGstin } from '@/lib/utils';

type Customer = any;

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback((s?: string) => {
    setLoading(true);
    getCustomers({ search: s || undefined }).then(r => setCustomers(r.customers)).finally(() => setLoading(false));
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
      await saveCustomer(data);
      toast.success(editing ? 'Customer updated' : 'Customer added');
      setDialogOpen(false);
      setEditing(null);
      load(search);
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteCustomerApi({ id: deleteId });
      setCustomers(c => c.filter(x => x.id !== deleteId));
      toast.success('Customer deleted');
    } catch { toast.error('Failed to delete'); }
    setDeleteId(null);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-sm text-muted-foreground">{customers.length} customers</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="w-4 h-4 mr-2" />Add Customer</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search customers..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); debouncedSearch(e.target.value); }} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : customers.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No customers found. Add your first customer to get started.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map(c => (
            <Card key={c.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{c.customerName}</h3>
                    {c.customerType && <Badge variant="secondary" className="text-[10px] mt-1">{c.customerType}</Badge>}
                    {c.gstin && <p className="text-xs text-muted-foreground font-mono mt-0.5">{c.gstin}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(c); setDialogOpen(true); }}><Edit className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {c.email && <p className="flex items-center gap-1.5"><Mail className="w-3 h-3" />{c.email}</p>}
                  {c.phone && <p className="flex items-center gap-1.5"><Phone className="w-3 h-3" />{c.phone}</p>}
                  {c.billingCity && <p>{c.billingCity}, {c.billingState}</p>}
                </div>
                <div className="mt-3 pt-3 border-t flex justify-between text-xs">
                  <span>Invoices: {c.totalInvoices || 0}</span>
                  <span className="font-semibold">{formatCurrency(c.totalRevenue)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) { setDialogOpen(false); setEditing(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Customer' : 'Add Customer'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Customer Name *</Label><Input name="customerName" required defaultValue={editing?.customerName} /></div>
              <div>
                <Label>Customer Type</Label>
                <Select name="customerType" defaultValue={editing?.customerType}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Retailer">Retailer</SelectItem>
                    <SelectItem value="Wholesaler">Wholesaler</SelectItem>
                    <SelectItem value="Challan">Challan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>GSTIN</Label><Input name="gstin" placeholder="22AAAAA0000A1Z5" defaultValue={editing?.gstin} /></div>
              <div><Label>Email</Label><Input name="email" type="email" defaultValue={editing?.email} /></div>
              <div><Label>Phone</Label><Input name="phone" defaultValue={editing?.phone} /></div>
            </div>
            <h4 className="text-sm font-semibold pt-2">Billing Address</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2"><Textarea name="billingAddress" placeholder="Street address" rows={2} defaultValue={editing?.billingAddress} /></div>
              <div><Label>City</Label><Input name="billingCity" defaultValue={editing?.billingCity} /></div>
              <div>
                <Label>State</Label>
                <Select name="billingState" defaultValue={editing?.billingState}>
                  <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                  <SelectContent>{INDIAN_STATES.map(s => <SelectItem key={s.code} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>State Code</Label><Input name="billingStateCode" defaultValue={editing?.billingStateCode} /></div>
              <div><Label>Pincode</Label><Input name="billingPincode" defaultValue={editing?.billingPincode} /></div>
            </div>
            <h4 className="text-sm font-semibold pt-2">Shipping Address</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2"><Textarea name="shippingAddress" rows={2} defaultValue={editing?.shippingAddress} /></div>
              <div><Label>City</Label><Input name="shippingCity" defaultValue={editing?.shippingCity} /></div>
              <div><Label>State</Label><Input name="shippingState" defaultValue={editing?.shippingState} /></div>
              <div><Label>Pincode</Label><Input name="shippingPincode" defaultValue={editing?.shippingPincode} /></div>
            </div>
            <DialogFooter><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Customer'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Customer?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
