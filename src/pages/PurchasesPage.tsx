import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPurchases, deletePurchase as deletePurchaseApi } from 'zite-endpoints-sdk';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, Trash2, ShoppingCart, Search, ChevronDown, ChevronUp, FileText } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedBill, setExpandedBill] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getPurchases({}).then(r => setBills(r.bills)).finally(() => setLoading(false));
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

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Purchase Bills</h1>
          <p className="text-sm text-muted-foreground">{bills.length} bills — each bill contains multiple products</p>
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
              <Card key={bill.purchaseNumber} className="overflow-hidden">
                {/* Bill Header */}
                <button
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-accent/50 transition-colors"
                  onClick={() => toggleBill(bill.purchaseNumber)}
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm">{bill.purchaseNumber}</span>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{bill.totalItems} {bill.totalItems === 1 ? 'item' : 'items'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span>{formatDate(bill.purchaseDate)}</span>
                      {(bill.supplierName || bill.supplierInvoiceNumber) && (
                        <>
                          <span>•</span>
                          <span className="font-medium text-foreground">{bill.supplierName || bill.supplierInvoiceNumber}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-primary text-base">{formatCurrency(Math.round(bill.totalAmount))}</div>
                    <div className="text-[10px] text-muted-foreground">Total</div>
                  </div>
                  <div className="shrink-0 text-muted-foreground">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {/* Bill Items (expanded) */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left px-3 py-2 font-semibold text-muted-foreground">#</th>
                            <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Product</th>
                            <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Pack</th>
                            <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Batch</th>
                            <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Expiry</th>
                            <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Qty</th>
                            <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Free</th>
                            <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Rate</th>
                            <th className="text-right px-3 py-2 font-semibold text-muted-foreground">MRP</th>
                            <th className="text-right px-3 py-2 font-semibold text-muted-foreground">GST%</th>
                            <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Amount</th>
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
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteId(item.id)}><Trash2 className="w-3 h-3" /></Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-muted/30">
                            <td colSpan={5} className="px-3 py-2 text-right font-semibold text-xs text-muted-foreground">
                              {bill.totalItems} items
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-xs">
                              {bill.items.reduce((s: number, i: any) => s + (i.quantity || 0), 0)}
                            </td>
                            <td className="px-3 py-2 text-right text-xs">
                              {bill.items.reduce((s: number, i: any) => s + (i.freeQuantity || 0), 0) || '-'}
                            </td>
                            <td colSpan={3}></td>
                            <td className="px-3 py-2 text-right font-bold text-primary">
                              {formatCurrency(Math.round(bill.totalAmount))}
                            </td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden divide-y divide-border">
                      {bill.items.map((item: any, idx: number) => (
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
                      {/* Mobile total */}
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

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this item?</AlertDialogTitle><AlertDialogDescription>This will remove this item from the purchase bill. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteItem}>Delete</AlertDialogAction></AlertDialogFooter>
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
