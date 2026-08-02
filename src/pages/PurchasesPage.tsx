import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPurchases, deletePurchase as deletePurchaseApi, getCompany } from 'zite-endpoints-sdk';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, Trash2, ShoppingCart, Search, ChevronDown, ChevronUp, FileText, Edit, Printer, Eye, Building2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

type PurchaseBill = {
  purchaseNumber: string;
  purchaseDate: string;
  supplierName: string;
  supplierInvoiceNumber: string;
  items: any[];
  totalAmount: number;
  totalItems: number;
};

export default function PurchasesPage() {
  const navigate = useNavigate();
  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedBill, setExpandedBill] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Purchase Bill Full View Modal State
  const [viewBill, setViewBill] = useState<PurchaseBill | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      getPurchases({}),
      getCompany({}),
    ]).then(([pRes, cRes]) => {
      setBills(pRes.bills || []);
      setCompany(cRes.company || null);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDeleteItem = async () => {
    if (!deleteId) return;
    try {
      await deletePurchaseApi({ id: deleteId });
      toast.success('Item deleted');
      load();
    } catch { toast.error('Failed'); }
    setDeleteId(null);
  };

  const filtered = bills.filter(b =>
    !search ||
    b.purchaseNumber?.toLowerCase().includes(search.toLowerCase()) ||
    b.supplierName?.toLowerCase().includes(search.toLowerCase()) ||
    b.supplierInvoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
    b.items.some((it: any) => it.productName?.toLowerCase().includes(search.toLowerCase()) || it.batchNumber?.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleBill = (pn: string) => {
    setExpandedBill(prev => prev === pn ? null : pn);
  };

  const handlePrintPurchaseInvoice = () => {
    if (!viewBill) return;
    window.print();
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Purchase Bills</h1>
          <p className="text-sm text-muted-foreground">{bills.length} bills — view, edit, or enter purchase invoices</p>
        </div>
        <Button onClick={() => navigate('/purchases/new')}><Plus className="w-4 h-4 mr-2" />New Purchase Bill</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search by bill no, supplier, product..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : bills.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <ShoppingCart className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
          <p>No purchase bills yet.</p>
          <Button className="mt-4" onClick={() => navigate('/purchases/new')}>Create First Purchase Bill</Button>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(bill => {
            const isExpanded = expandedBill === bill.purchaseNumber;
            return (
              <Card key={bill.purchaseNumber} className="overflow-hidden border border-border">
                {/* Bill Header */}
                <div className="px-4 py-3 flex items-center justify-between gap-3 bg-card hover:bg-accent/30 transition-colors">
                  <button
                    className="flex-1 text-left flex items-center gap-3 min-w-0 cursor-pointer"
                    onClick={() => toggleBill(bill.purchaseNumber)}
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-foreground">{bill.purchaseNumber}</span>
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-semibold">{bill.totalItems} {bill.totalItems === 1 ? 'item' : 'items'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        <span>{formatDate(bill.purchaseDate)}</span>
                        {(bill.supplierName || bill.supplierInvoiceNumber) && (
                          <>
                            <span>•</span>
                            <span className="font-semibold text-foreground">{bill.supplierName || bill.supplierInvoiceNumber}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 pr-2">
                      <div className="font-bold text-primary text-base">{formatCurrency(Math.round(bill.totalAmount))}</div>
                      <div className="text-[10px] text-muted-foreground">Total Bill</div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2.5 text-xs font-semibold gap-1 bg-background hover:bg-muted"
                      onClick={() => setViewBill(bill)}
                      title="View Full Purchase Invoice"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      <span className="hidden sm:inline">View Invoice</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2.5 text-xs font-semibold gap-1 bg-background hover:bg-muted text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800"
                      onClick={() => navigate(`/purchases/${bill.purchaseNumber}/edit`)}
                      title="Modify Purchase Bill"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Modify</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground"
                      onClick={() => toggleBill(bill.purchaseNumber)}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Bill Items (expanded) */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left px-3 py-2 font-semibold text-muted-foreground">#</th>
                            <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Product Name</th>
                            <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Pack</th>
                            <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Batch</th>
                            <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Expiry</th>
                            <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Qty</th>
                            <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Free</th>
                            <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Pur. Rate</th>
                            <th className="text-right px-3 py-2 font-semibold text-muted-foreground">MRP</th>
                            <th className="text-right px-3 py-2 font-semibold text-muted-foreground">GST%</th>
                            <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Total Amount</th>
                            <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Stock</th>
                            <th className="w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {bill.items.map((item: any, idx: number) => (
                            <tr key={item.id} className={`border-b border-border/40 ${idx % 2 === 0 ? '' : 'bg-accent/20'}`}>
                              <td className="px-3 py-1.5 text-muted-foreground">{idx + 1}</td>
                              <td className="px-3 py-1.5 font-semibold">
                                {item.productName}
                                {item.manufacturer && <span className="text-muted-foreground font-normal ml-1">({item.manufacturer})</span>}
                              </td>
                              <td className="px-3 py-1.5 text-muted-foreground">{item.packSize || '-'}</td>
                              <td className="px-3 py-1.5 font-mono">{item.batchNumber}</td>
                              <td className="px-3 py-1.5">{item.expiryDate || '-'}</td>
                              <td className="px-3 py-1.5 text-right font-semibold">{item.quantity}</td>
                              <td className="px-3 py-1.5 text-right">{item.freeQuantity || '-'}</td>
                              <td className="px-3 py-1.5 text-right font-mono">{formatCurrency(item.purchaseRate)}</td>
                              <td className="px-3 py-1.5 text-right font-mono">{formatCurrency(item.mrp)}</td>
                              <td className="px-3 py-1.5 text-right">{item.gstPercentage}%</td>
                              <td className="px-3 py-1.5 text-right font-mono font-semibold">{formatCurrency(item.totalAmount || item.quantity * item.purchaseRate)}</td>
                              <td className="px-3 py-1.5 text-right">
                                <StockBadge stock={item.currentStock} status={item.status} />
                              </td>
                              <td className="px-1">
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(item.id)}><Trash2 className="w-3 h-3" /></Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-muted/30">
                            <td colSpan={5} className="px-3 py-2 text-right font-semibold text-xs text-muted-foreground">
                              Total ({bill.totalItems} items)
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-xs">
                              {bill.items.reduce((s: number, i: any) => s + (i.quantity || 0), 0)}
                            </td>
                            <td className="px-3 py-2 text-right text-xs">
                              {bill.items.reduce((s: number, i: any) => s + (i.freeQuantity || 0), 0) || '-'}
                            </td>
                            <td colSpan={3}></td>
                            <td className="px-3 py-2 text-right font-bold text-primary text-sm">
                              {formatCurrency(Math.round(bill.totalAmount))}
                            </td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden divide-y divide-border">
                      {bill.items.map((item: any) => (
                        <div key={item.id} className="px-4 py-2.5">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm">{item.productName}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {item.manufacturer && `${item.manufacturer} • `}Batch: <span className="font-mono">{item.batchNumber}</span>
                                {item.expiryDate && ` • Exp: ${item.expiryDate}`}
                              </p>
                            </div>
                            <StockBadge stock={item.currentStock} status={item.status} />
                          </div>
                          <div className="flex items-center justify-between mt-1 text-xs">
                            <div className="text-muted-foreground">
                              Qty: <span className="font-semibold text-foreground">{item.quantity}</span>
                              {item.freeQuantity ? `+${item.freeQuantity}` : ''}
                              {' • '}Rate: {formatCurrency(item.purchaseRate)}
                              {' • '}MRP: {formatCurrency(item.mrp)}
                              {' • '}GST: {item.gstPercentage}%
                            </div>
                            <span className="font-bold font-mono">{formatCurrency(item.totalAmount || item.quantity * item.purchaseRate)}</span>
                          </div>
                        </div>
                      ))}
                      <div className="px-4 py-2.5 bg-muted/30 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{bill.totalItems} items • Total Qty: {bill.items.reduce((s: number, i: any) => s + (i.quantity || 0), 0)}</span>
                        <span className="font-bold text-primary">{formatCurrency(Math.round(bill.totalAmount))}</span>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Full Purchase Invoice Detail View Modal */}
      <Dialog open={!!viewBill} onOpenChange={() => setViewBill(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 border border-border">
          {viewBill && (
            <div className="p-6 space-y-6 bg-card text-card-foreground print:p-0 print:bg-white print:text-black">
              {/* Action buttons bar */}
              <div className="flex items-center justify-between border-b border-border pb-4 print:hidden">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  <span className="font-bold text-lg">Purchase Invoice Detail</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setViewBill(null);
                      navigate(`/purchases/${viewBill.purchaseNumber}/edit`);
                    }}
                    className="gap-1.5"
                  >
                    <Edit className="w-4 h-4 text-amber-600" /> Modify Bill
                  </Button>
                  <Button size="sm" onClick={handlePrintPurchaseInvoice} className="gap-1.5">
                    <Printer className="w-4 h-4" /> Print / PDF
                  </Button>
                </div>
              </div>

              {/* Printable Invoice View Sheet */}
              <div className="border border-border rounded-lg p-6 space-y-6 bg-background dark:bg-card">
                {/* Invoice Header */}
                <div className="flex justify-between items-start gap-4 border-b border-border pb-4 flex-wrap">
                  <div>
                    <h2 className="text-xl font-black text-primary tracking-tight">
                      {company?.companyName || 'NIRAJ PHARMA'}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
                      {company?.address || 'MAHAVIR ROAD MIRZAGANJ GIRIDIH JHARKHAND'}
                    </p>
                    <div className="text-[11px] text-muted-foreground mt-1 space-y-0.5 font-mono">
                      {company?.gstin && <p>GSTIN: <span className="font-semibold text-foreground">{company.gstin}</span></p>}
                      {company?.dlNumber1 && <p>D.L. No: <span className="font-semibold text-foreground">{company.dlNumber1}</span></p>}
                      {company?.phone && <p>Ph: {company.phone}</p>}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="inline-block px-3 py-1 bg-primary/10 text-primary font-bold text-xs rounded-full uppercase tracking-wider mb-2">
                      Purchase Invoice
                    </span>
                    <p className="text-sm font-bold font-mono text-foreground">Ref No: {viewBill.purchaseNumber}</p>
                    {viewBill.supplierInvoiceNumber && (
                      <p className="text-xs text-muted-foreground font-mono">Supplier Bill #: <span className="font-bold text-foreground">{viewBill.supplierInvoiceNumber}</span></p>
                    )}
                    <p className="text-xs text-muted-foreground">Date: {formatDate(viewBill.purchaseDate)}</p>
                  </div>
                </div>

                {/* Seller / Supplier Details */}
                <div className="bg-muted/40 p-3 rounded-lg border border-border">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Supplier / Vendor Information</p>
                  <p className="text-sm font-bold text-foreground">{viewBill.supplierName || 'General Supplier / Stock Inward'}</p>
                </div>

                {/* Items Table */}
                <div className="overflow-x-auto border border-border rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted text-muted-foreground border-b border-border font-semibold">
                      <tr>
                        <th className="p-2 w-8 text-center">#</th>
                        <th className="p-2">Item Name / Manufacturer</th>
                        <th className="p-2">HSN</th>
                        <th className="p-2">Pack</th>
                        <th className="p-2">Batch</th>
                        <th className="p-2">Exp</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2 text-right">Free</th>
                        <th className="p-2 text-right">Pur. Rate</th>
                        <th className="p-2 text-right">MRP</th>
                        <th className="p-2 text-right">GST%</th>
                        <th className="p-2 text-right">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {viewBill.items.map((it: any, idx: number) => {
                        const taxable = (it.quantity || 0) * (it.purchaseRate || 0);
                        const gstAmt = taxable * ((it.gstPercentage || 12) / 100);
                        const totalLine = it.totalAmount || (taxable + gstAmt);
                        return (
                          <tr key={it.id || idx}>
                            <td className="p-2 text-center text-muted-foreground">{idx + 1}</td>
                            <td className="p-2 font-semibold text-foreground">
                              {it.productName || it.itemName}
                              {it.manufacturer && <span className="block text-[10px] text-muted-foreground font-normal">{it.manufacturer}</span>}
                            </td>
                            <td className="p-2 font-mono text-muted-foreground">{it.hsnSacCode || '-'}</td>
                            <td className="p-2 text-muted-foreground">{it.packSize || '-'}</td>
                            <td className="p-2 font-mono text-foreground font-semibold">{it.batchNumber}</td>
                            <td className="p-2 text-muted-foreground">{it.expiryDate || '-'}</td>
                            <td className="p-2 text-right font-bold">{it.quantity}</td>
                            <td className="p-2 text-right text-muted-foreground">{it.freeQuantity || '-'}</td>
                            <td className="p-2 text-right font-mono">{formatCurrency(it.purchaseRate)}</td>
                            <td className="p-2 text-right font-mono text-muted-foreground">{formatCurrency(it.mrp)}</td>
                            <td className="p-2 text-right">{it.gstPercentage}%</td>
                            <td className="p-2 text-right font-bold font-mono">{formatCurrency(totalLine)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Total Summary */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-2 border-t border-border">
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p><span className="font-bold text-foreground">Total Items:</span> {viewBill.totalItems}</p>
                    <p><span className="font-bold text-foreground">Total Quantity:</span> {viewBill.items.reduce((s: number, i: any) => s + (i.quantity || 0), 0)}</p>
                  </div>

                  <div className="w-full sm:w-64 space-y-1.5 text-xs bg-muted/30 p-3 rounded-lg border border-border">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal (Taxable):</span>
                      <span className="font-mono">
                        {formatCurrency(
                          viewBill.items.reduce((s: number, i: any) => s + ((i.quantity || 0) * (i.purchaseRate || 0)), 0)
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Total GST Tax:</span>
                      <span className="font-mono">
                        {formatCurrency(
                          viewBill.items.reduce((s: number, i: any) => {
                            const tax = (i.quantity || 0) * (i.purchaseRate || 0);
                            return s + (tax * ((i.gstPercentage || 12) / 100));
                          }, 0)
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold text-base text-primary pt-2 border-t border-border">
                      <span>Grand Total:</span>
                      <span className="font-mono">{formatCurrency(Math.round(viewBill.totalAmount))}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this item?</AlertDialogTitle>
            <AlertDialogDescription>This will remove this item from the purchase bill. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteItem}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StockBadge({ stock, status }: { stock?: number; status?: string }) {
  const s = status || 'Active';
  const color = s === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : s === 'Low Stock' ? 'bg-amber-500/10 text-amber-600' : 'bg-destructive/10 text-destructive';
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${color}`}>{stock || 0}</span>;
}
