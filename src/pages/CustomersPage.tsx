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
  const [defaultType, setDefaultType] = useState<string>('Wholesaler');
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

  const isRetail = (c: any) => c.customerType === 'Retailer' || c.customerType === 'Retail';
  const wholesaleChallanCustomers = customers.filter(c => !isRetail(c));
  const retailCustomers = customers.filter(c => isRetail(c));

  const openAddModal = (type: string) => {
    setEditing(null);
    setDefaultType(type);
    setDialogOpen(true);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Customers Directory</h1>
          <p className="text-sm text-muted-foreground">{customers.length} total customers saved</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => openAddModal('Retailer')}>
            <Plus className="w-4 h-4 mr-1.5" />Add Retail Customer
          </Button>
          <Button onClick={() => openAddModal('Wholesaler')}>
            <Plus className="w-4 h-4 mr-1.5" />Add Wholesale / Challan Party
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search customers by name, phone or GSTIN..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); debouncedSearch(e.target.value); }} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Column 1: Wholesale & Challan Customers */}
          <div className="space-y-4 bg-muted/20 p-4 rounded-xl border border-border">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Badge className="bg-primary text-primary-foreground font-bold px-2 py-0.5 text-xs">
                  Wholesale & Challan
                </Badge>
                <span className="text-xs text-muted-foreground font-medium">({wholesaleChallanCustomers.length} parties)</span>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-xs font-semibold text-primary" onClick={() => openAddModal('Wholesaler')}>
                <Plus className="w-3.5 h-3.5 mr-1" />Add Party
              </Button>
            </div>

            {wholesaleChallanCustomers.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground bg-card rounded-lg border border-dashed border-border p-4">
                No Wholesale or Challan customers added yet.<br />
                Click <strong>Add Party</strong> above to create one for B2B/Challan invoices.
              </div>
            ) : (
              <div className="space-y-3">
                {wholesaleChallanCustomers.map(c => (
                  <Card key={c.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-bold text-sm text-foreground">{c.customerName}</h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                              {c.customerType || 'Wholesaler'}
                            </Badge>
                            {c.gstin && <span className="text-[11px] font-mono text-muted-foreground">GST: {c.gstin}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(c); setDialogOpen(true); }}><Edit className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {c.phone && <p className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-primary" />{c.phone}</p>}
                        {c.email && <p className="flex items-center gap-1.5"><Mail className="w-3 h-3" />{c.email}</p>}
                        {(c.billingAddress || c.billingCity) && <p className="truncate max-w-full">{[c.billingAddress, c.billingCity, c.billingState].filter(Boolean).join(', ')}</p>}
                      </div>
                      <div className="mt-2 pt-2 border-t flex justify-between text-[11px] text-muted-foreground">
                        <span>Total Invoices: <strong>{c.totalInvoices || 0}</strong></span>
                        <span className="font-semibold text-foreground">{formatCurrency(c.totalRevenue)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Column 2: Retail Customers */}
          <div className="space-y-4 bg-muted/20 p-4 rounded-xl border border-border">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold px-2 py-0.5 text-xs dark:bg-emerald-950/40 dark:text-emerald-300">
                  Retail Customers
                </Badge>
                <span className="text-xs text-muted-foreground font-medium">({retailCustomers.length} customers)</span>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-xs font-semibold text-emerald-600 dark:text-emerald-400" onClick={() => openAddModal('Retailer')}>
                <Plus className="w-3.5 h-3.5 mr-1" />Add Customer
              </Button>
            </div>

            {retailCustomers.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground bg-card rounded-lg border border-dashed border-border p-4">
                No saved Retail customers.<br />
                Retail sales can be made as walk-in or saved here.
              </div>
            ) : (
              <div className="space-y-3">
                {retailCustomers.map(c => (
                  <Card key={c.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-bold text-sm text-foreground">{c.customerName}</h3>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 mt-0.5 font-medium border-emerald-300 text-emerald-700 dark:text-emerald-300">
                            Retail Customer
                          </Badge>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(c); setDialogOpen(true); }}><Edit className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {c.phone && <p className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-emerald-600" />{c.phone}</p>}
                        {c.email && <p className="flex items-center gap-1.5"><Mail className="w-3 h-3" />{c.email}</p>}
                        {(c.billingAddress || c.billingCity) && <p className="truncate max-w-full">{[c.billingAddress, c.billingCity, c.billingState].filter(Boolean).join(', ')}</p>}
                      </div>
                      <div className="mt-2 pt-2 border-t flex justify-between text-[11px] text-muted-foreground">
                        <span>Total Invoices: <strong>{c.totalInvoices || 0}</strong></span>
                        <span className="font-semibold text-foreground">{formatCurrency(c.totalRevenue)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
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
                <Label>Customer Category / Type</Label>
                <Select name="customerType" defaultValue={editing?.customerType || defaultType}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Wholesaler">Wholesaler (Wholesale Customer)</SelectItem>
                    <SelectItem value="Challan">Challan (Delivery Challan Party)</SelectItem>
                    <SelectItem value="Retailer">Retailer (Retail Customer)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>GSTIN</Label><Input name="gstin" placeholder="22AAAAA0000A1Z5" defaultValue={editing?.gstin} /></div>
              <div><Label>Phone</Label><Input name="phone" defaultValue={editing?.phone} /></div>
              <div><Label>Email</Label><Input name="email" type="email" defaultValue={editing?.email} /></div>
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
