import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getInvoices, deleteInvoice as deleteInvoiceApi, generateInvoicePdf } from 'zite-endpoints-sdk';
import { useDebouncedCallback } from 'use-debounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, Search, Eye, Trash2, Download, Printer } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  Paid: 'bg-emerald-500/10 text-emerald-600',
  Pending: 'bg-amber-500/10 text-amber-600',
  Draft: 'bg-muted text-muted-foreground',
  Cancelled: 'bg-destructive/10 text-destructive',
  Overdue: 'bg-destructive/10 text-destructive',
  'Partially Paid': 'bg-blue-500/10 text-blue-600',
};

export default function InvoicesPage() {
  const [params] = useSearchParams();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(params.get('status') || '');
  const [typeFilter, setTypeFilter] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const load = useCallback((s?: string) => {
    setLoading(true);
    getInvoices({
      search: s || undefined,
      status: statusFilter || undefined,
      type: typeFilter || undefined,
    }).then(r => setInvoices(r.invoices)).finally(() => setLoading(false));
  }, [statusFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);
  const debouncedSearch = useDebouncedCallback((val: string) => load(val), 400);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteInvoiceApi({ id: deleteId });
      setInvoices(i => i.filter(x => x.id !== deleteId));
      toast.success('Invoice deleted');
    } catch { toast.error('Failed to delete'); }
    setDeleteId(null);
  };

  const handleDownload = async (invoiceId: string) => {
    setGeneratingId(invoiceId);
    try {
      const { url, html } = await generateInvoicePdf({ invoiceId }) as any;
      if (html) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          setTimeout(() => {
            printWindow.focus();
            printWindow.print();
          }, 500);
        } else {
          toast.error("Popup blocked. Please allow popups to print.");
        }
      } else if (url) {
        window.open(url, '_blank');
      }
    } catch {
      toast.error('Failed to generate PDF');
    } finally {
      setGeneratingId(null);
    }
  };

  const handlePrint = handleDownload;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-sm text-muted-foreground">{invoices.length} invoices</p>
        </div>
        <Link to="/invoices/new"><Button><Plus className="w-4 h-4 mr-2" />New Invoice</Button></Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by invoice #..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); debouncedSearch(e.target.value); }} />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {['Draft', 'Pending', 'Paid', 'Partially Paid', 'Overdue', 'Cancelled'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={v => setTypeFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {['Tax Invoice', 'Retail Sale', 'Wholesale', 'Challan', 'Quotation', 'Proforma', 'Credit Note', 'Debit Note'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : invoices.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No invoices found. Create your first invoice!</CardContent></Card>
      ) : (
        <div className="space-y-2">
          <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_100px_110px_100px_130px] gap-3 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">
            <span>Invoice #</span><span>Customer</span><span>Type</span><span>Date</span><span className="text-right">Amount</span><span>Status</span><span className="text-right">Actions</span>
          </div>
          {invoices.map(inv => (
            <Card key={inv.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_100px_110px_100px_130px] gap-3 items-center">
                  <Link to={`/invoices/${inv.id}`} className="font-semibold text-sm text-primary hover:underline">{inv.invoiceNumber}</Link>
                  <span className="text-sm truncate">{inv.customerName}</span>
                  <span className="text-xs text-muted-foreground">{inv.type}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(inv.invoiceDate)}</span>
                  <span className="text-sm font-semibold text-right">{formatCurrency(inv.totalAmount)}</span>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold w-fit ${STATUS_COLORS[inv.status] || ''}`}>{inv.status}</span>
                  <div className="flex gap-1 justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Download PDF"
                      disabled={generatingId === inv.id}
                      onClick={() => handleDownload(inv.id)}
                    >
                      <Download className={`w-3.5 h-3.5 ${generatingId === inv.id ? 'animate-pulse' : ''}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Print"
                      disabled={generatingId === inv.id}
                      onClick={() => handlePrint(inv.id)}
                    >
                      <Printer className={`w-3.5 h-3.5 ${generatingId === inv.id ? 'animate-pulse' : ''}`} />
                    </Button>
                    <Link to={`/invoices/${inv.id}`}><Button variant="ghost" size="icon" className="h-7 w-7" title="View"><Eye className="w-3.5 h-3.5" /></Button></Link>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Delete" onClick={() => setDeleteId(inv.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
                {/* Mobile */}
                <div className="md:hidden space-y-2">
                  <div className="flex items-center justify-between">
                    <Link to={`/invoices/${inv.id}`} className="font-semibold text-sm text-primary">{inv.invoiceNumber}</Link>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[inv.status] || ''}`}>{inv.status}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{inv.customerName}</span>
                    <span className="font-semibold text-foreground">{formatCurrency(inv.totalAmount)}</span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="h-7 text-xs flex-1" disabled={generatingId === inv.id} onClick={() => handleDownload(inv.id)}>
                      <Download className="w-3 h-3 mr-1" />{generatingId === inv.id ? 'Wait...' : 'PDF'}
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs flex-1" disabled={generatingId === inv.id} onClick={() => handlePrint(inv.id)}>
                      <Printer className="w-3 h-3 mr-1" />Print
                    </Button>
                    <Link to={`/invoices/${inv.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="h-7 text-xs w-full"><Eye className="w-3 h-3 mr-1" />View</Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Invoice?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this invoice and its items.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
