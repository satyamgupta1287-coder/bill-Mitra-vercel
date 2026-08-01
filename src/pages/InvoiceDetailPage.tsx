import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInvoiceDetail, generateInvoicePdf, recordPayment, deleteInvoice } from 'zite-endpoints-sdk';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ArrowLeft, Download, CreditCard, FileText, Edit, Trash2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  Paid: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  Pending: 'bg-amber-500/10 text-amber-600 border-amber-200',
  Draft: 'bg-muted text-muted-foreground',
  Cancelled: 'bg-destructive/10 text-destructive',
  Overdue: 'bg-destructive/10 text-destructive',
  'Partially Paid': 'bg-blue-500/10 text-blue-600 border-blue-200',
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [overrideTemplate, setOverrideTemplate] = useState<string>('');

  useEffect(() => {
    if (!id) return;
    getInvoiceDetail({ invoiceId: id }).then(res => {
      setData(res);
      if (res?.invoice?.selectedTemplate) {
        setOverrideTemplate(res.invoice.selectedTemplate);
      } else if (res?.invoice?.type === 'Wholesale') {
        setOverrideTemplate('Wholesale Invoice');
      } else if (res?.invoice?.type === 'Challan') {
        setOverrideTemplate('Delivery Challan');
      } else if (res?.invoice?.type === 'Retail Sale') {
        setOverrideTemplate('Retail Invoice');
      }
    }).finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) return;
    setDeleting(true);
    try {
      await deleteInvoice({ id });
      toast.success('Invoice deleted');
      navigate('/invoices');
    } catch {
      toast.error('Failed to delete invoice');
      setDeleting(false);
    }
  };

  const handlePdf = async () => {
    if (!id) return;
    setGenerating(true);
    try {
      const { url, html } = await generateInvoicePdf({ invoiceId: id, templateOverride: overrideTemplate || undefined }) as any;
      if (html) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          // Give it a moment to load styles/images
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
    } catch { toast.error('Failed to generate PDF'); }
    finally { setGenerating(false); }
  };

  const handlePayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!id) return;
    const fd = new FormData(e.currentTarget);
    setPaymentSaving(true);
    try {
      const result = await recordPayment({
        invoiceId: id,
        amount: Number(fd.get('amount')),
        paymentDate: fd.get('paymentDate') as string,
        method: fd.get('method') as string,
        notes: (fd.get('notes') as string) || undefined,
      });
      setData((d: any) => ({ ...d, invoice: result.invoice, payments: [...(d?.payments || []), result.payment] }));
      toast.success('Payment recorded');
      setPaymentOpen(false);
    } catch { toast.error('Failed to record payment'); }
    finally { setPaymentSaving(false); }
  };

  if (loading) return <div className="p-8"><Skeleton className="h-96 rounded-xl" /></div>;
  if (!data) return <div className="p-8 text-center text-muted-foreground">Invoice not found</div>;

  const { invoice, items, customer, company, payments } = data;
  const isIgst = (invoice.igstAmount || 0) > 0;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/invoices')}><ArrowLeft className="w-4 h-4" /></Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{invoice.invoiceNumber}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[invoice.status] || ''}`}>{invoice.status}</span>
            </div>
            <p className="text-sm text-muted-foreground">{invoice.type} • {formatDate(invoice.invoiceDate)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={overrideTemplate}
            onChange={e => setOverrideTemplate(e.target.value)}
            className="h-9 text-xs border rounded-md px-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Auto (Default for {invoice.type})</option>
            <optgroup label="Pharma / Medical">
              <option value="Classic GST">Classic GST</option>
              <option value="Modern GST">Modern GST</option>
              <option value="Retail Invoice">Retail Invoice</option>
              <option value="Wholesale Invoice">Wholesale Invoice</option>
              <option value="Delivery Challan">Delivery Challan</option>
              <option value="Tax Invoice Premium">Tax Invoice Premium</option>
            </optgroup>
            <optgroup label="General">
              <option value="General GST">General GST</option>
              <option value="Indian Retail Bill">Indian Retail Bill</option>
              <option value="Proforma Invoice">Proforma Invoice</option>
              <option value="Thermal Receipt">Thermal Receipt</option>
            </optgroup>
            <optgroup label="Industry Specific">
              <option value="Electronics / Mobile">Electronics / Mobile</option>
              <option value="Restaurant / Food">Restaurant / Food</option>
              <option value="Grocery / Kirana">Grocery / Kirana</option>
              <option value="Furniture / Hardware">Furniture / Hardware</option>
              <option value="Services Invoice">Services Invoice</option>
            </optgroup>
          </select>
          <Button variant="outline" onClick={() => navigate('/invoices/' + invoice.id + '/edit')}><Edit className="w-4 h-4 mr-2" />Edit</Button>
          <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={handleDelete} disabled={deleting}><Trash2 className="w-4 h-4 mr-2" />{deleting ? 'Deleting...' : 'Delete'}</Button>
          {invoice.status !== 'Paid' && invoice.status !== 'Cancelled' && (
            <Button variant="outline" onClick={() => setPaymentOpen(true)}><CreditCard className="w-4 h-4 mr-2" />Record Payment</Button>
          )}
          <Button onClick={handlePdf} disabled={generating}>
            <FileText className="w-4 h-4 mr-2" />{generating ? 'Generating...' : 'Print / Save PDF'}
          </Button>
        </div>
      </div>

      {/* Company & Customer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-xs uppercase text-muted-foreground tracking-wider">From</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            {company?.logo?.[0]?.url && (
              <img src={company.logo[0].url} alt="Logo" className="h-10 w-auto object-contain mb-2" />
            )}
            <p className="font-semibold">{company?.companyName}</p>
            {company?.gstin && <p className="text-xs font-mono text-muted-foreground">GSTIN: {company.gstin}</p>}
            <p className="text-muted-foreground">{company?.address}{company?.city ? ', ' + company.city : ''}</p>
            <p className="text-muted-foreground">{company?.state} {company?.pincode}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-xs uppercase text-muted-foreground tracking-wider">Bill To</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="font-semibold">{customer?.customerName}</p>
            {customer?.gstin && <p className="text-xs font-mono text-muted-foreground">GSTIN: {customer.gstin}</p>}
            <p className="text-muted-foreground">{customer?.billingAddress}{customer?.billingCity ? ', ' + customer.billingCity : ''}</p>
            <p className="text-muted-foreground">{customer?.billingState} {customer?.billingPincode}</p>
          </CardContent>
        </Card>
      </div>

      {/* Supply / Transport Info */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-6 text-sm">
          {invoice.placeOfSupply && <div><span className="text-muted-foreground">Place of Supply:</span> <strong>{invoice.placeOfSupply} ({invoice.placeOfSupplyCode})</strong></div>}
          {invoice.dueDate && <div><span className="text-muted-foreground">Due Date:</span> <strong>{formatDate(invoice.dueDate)}</strong></div>}
          {invoice.transport && <div><span className="text-muted-foreground">Transport:</span> <strong>{invoice.transport}</strong></div>}
          {invoice.lrNumber && <div><span className="text-muted-foreground">LR No.:</span> <strong>{invoice.lrNumber}</strong></div>}
          {invoice.cases > 0 && <div><span className="text-muted-foreground">Cases:</span> <strong>{invoice.cases}</strong></div>}
          {invoice.reverseCharge && <span className="px-2 py-0.5 bg-destructive/10 text-destructive rounded text-xs font-semibold">Reverse Charge Applicable</span>}
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Items</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-left py-2 pr-2">#</th>
                <th className="text-left py-2">Product</th>
                <th className="text-left py-2">HSN</th>
                <th className="text-left py-2">MFC</th>
                <th className="text-center py-2">Pack</th>
                <th className="text-center py-2">Qty</th>
                <th className="text-left py-2">Batch</th>
                <th className="text-center py-2">Exp</th>
                <th className="text-right py-2">MRP</th>
                <th className="text-right py-2">Rate</th>
                <th className="text-center py-2">Disc%</th>
                <th className="text-right py-2">Amount</th>
                <th className="text-center py-2">GST%</th>
                <th className="text-right py-2">Taxable</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, i: number) => (
                <tr key={item.id} className="border-b border-border/50">
                  <td className="py-2 pr-2 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 font-medium">{item.itemName}</td>
                  <td className="py-2 text-muted-foreground font-mono text-xs">{item.hsnSacCode}</td>
                  <td className="py-2 text-xs text-muted-foreground">{item.manufacturer}</td>
                  <td className="py-2 text-center text-xs">{item.packSize}</td>
                  <td className="py-2 text-center">{item.quantity}{item.freeQuantity > 0 ? `+${item.freeQuantity}` : ''}</td>
                  <td className="py-2 font-mono text-xs">{item.batchNumber}</td>
                  <td className="py-2 text-center text-xs">{item.expiryDate}</td>
                  <td className="py-2 text-right text-xs">{formatCurrency(item.mrp)}</td>
                  <td className="py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="py-2 text-center text-xs">{item.discountPercent > 0 ? `${item.discountPercent}%` : '-'}</td>
                  <td className="py-2 text-right font-semibold">{formatCurrency(item.total)}</td>
                  <td className="py-2 text-center">{item.gstPercentage}%</td>
                  <td className="py-2 text-right">{formatCurrency(item.taxableAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Totals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          {invoice.notes && <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground mb-1">Notes</p><p className="text-sm">{invoice.notes}</p></CardContent></Card>}
          {invoice.terms && <Card className="mt-4"><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground mb-1">Terms</p><p className="text-sm whitespace-pre-wrap">{invoice.terms}</p></CardContent></Card>}
        </div>
        <Card>
          <CardContent className="p-5 space-y-2">
            {(invoice.discountAmount || 0) > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Gross Amount</span><span>{formatCurrency((invoice.totalAmount || 0) + (invoice.discountAmount || 0) - (invoice.roundOff || 0))}</span></div>}
            {(invoice.discountAmount || 0) > 0 && <div className="flex justify-between text-sm text-destructive"><span>Less Discount</span><span>-{formatCurrency(invoice.discountAmount)}</span></div>}
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Taxable Value</span><span>{formatCurrency(invoice.subtotal)}</span></div>
            {!isIgst ? (
              <>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">CGST</span><span>{formatCurrency(invoice.cgstAmount)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">SGST</span><span>{formatCurrency(invoice.sgstAmount)}</span></div>
              </>
            ) : (
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">IGST</span><span>{formatCurrency(invoice.igstAmount)}</span></div>
            )}
            {invoice.roundOff !== 0 && invoice.roundOff !== undefined && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Round Off</span><span>{invoice.roundOff >= 0 ? '+' : ''}{Number(invoice.roundOff).toFixed(2)}</span></div>}
            <div className="border-t pt-2 flex justify-between text-lg font-bold"><span>Grand Total</span><span>{formatCurrency(invoice.totalAmount)}</span></div>
            <div className="flex justify-between text-sm text-emerald-600"><span>Amount Paid</span><span>{formatCurrency(invoice.amountPaid)}</span></div>
            <div className="flex justify-between text-sm font-semibold"><span>Balance Due</span><span>{formatCurrency(invoice.balanceDue)}</span></div>
          </CardContent>
        </Card>
      </div>

      {/* Payment History */}
      {payments.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Payment History</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {payments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/50">
                  <div>
                    <p className="text-sm font-medium">{p.paymentReference}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(p.paymentDate)} • {p.method}</p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-600">{formatCurrency(p.amount)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Dialog */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <form onSubmit={handlePayment} className="space-y-4">
            <div><Label>Amount (₹) *</Label><Input name="amount" type="number" step="0.01" required defaultValue={invoice.balanceDue} /></div>
            <div><Label>Payment Date *</Label><Input name="paymentDate" type="date" required defaultValue={new Date().toISOString().split('T')[0]} /></div>
            <div>
              <Label>Method *</Label>
              <Select name="method" defaultValue="Bank Transfer">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card', 'Other'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Notes</Label><Input name="notes" /></div>
            <DialogFooter><Button type="submit" disabled={paymentSaving}>{paymentSaving ? 'Saving...' : 'Record Payment'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
