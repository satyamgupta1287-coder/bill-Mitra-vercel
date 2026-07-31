import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSuppliers, getProducts, saveBulkPurchase } from 'zite-endpoints-sdk';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ArrowLeft, Search, X, Save } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

type LineItem = {
  itemName: string;
  productId?: string;
  hsnSacCode: string;
  quantity: number;
  freeQuantity: number;
  purchaseRate: number;
  mrp: number;
  gstPercentage: number;
  batchNumber: string;
  expiryDate: string;
  manufacturer: string;
  packSize: string;
};

const emptyItem = (): LineItem => ({
  itemName: '', hsnSacCode: '', quantity: 1, freeQuantity: 0,
  purchaseRate: 0, mrp: 0, gstPercentage: 12,
  batchNumber: '', expiryDate: '', manufacturer: '', packSize: '',
});

function focusField(row: number, field: string) {
  setTimeout(() => {
    const el = document.querySelector(`[data-row="${row}"][data-field="${field}"]`) as HTMLInputElement | null;
    if (el) { el.focus(); el.select(); setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50); }
  }, 30);
}

export default function CreatePurchasePage() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplierId, setSupplierId] = useState('');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);

  // Search states
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierList, setShowSupplierList] = useState(false);
  const supplierRef = useRef<HTMLDivElement>(null);
  const [activeProductRow, setActiveProductRow] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const justSelectedRef = useRef(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getSuppliers({}),
      getProducts({ limit: 500 }),
    ]).then(([suppRes, prodRes]) => {
      setSuppliers(suppRes.suppliers);
      setAllProducts(prodRes.products);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (supplierRef.current && !supplierRef.current.contains(e.target as Node)) setShowSupplierList(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedSupplier = suppliers.find(s => s.id === supplierId);

  const filteredSuppliers = suppliers.filter(s =>
    !supplierSearch || s.supplierName?.toLowerCase().includes(supplierSearch.toLowerCase()) || s.gstin?.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  const filteredProducts = allProducts.filter(p =>
    !productSearch || p.productName?.toLowerCase().includes(productSearch.toLowerCase()) || p.manufacturer?.toLowerCase().includes(productSearch.toLowerCase())
  );

  const selectSupplier = (s: any) => {
    setSupplierId(s.id);
    setSupplierSearch('');
    setShowSupplierList(false);
  };

  const updateItem = useCallback((i: number, field: string, value: any) => {
    setItems(prev => {
      const n = [...prev];
      (n[i] as any)[field] = value;
      return n;
    });
  }, []);

  const selectProduct = (rowIndex: number, p: any) => {
    justSelectedRef.current = true;
    setItems(prev => {
      const n = [...prev];
      n[rowIndex] = {
        ...n[rowIndex],
        itemName: p.productName,
        productId: p.id,
        hsnSacCode: p.hsnSacCode || '',
        mrp: p.mrp || 0,
        purchaseRate: p.unitPrice || 0,
        gstPercentage: p.gstPercentage || 12,
        manufacturer: p.manufacturer || '',
        packSize: p.packSize || '',
      };
      if (rowIndex === n.length - 1) n.push(emptyItem());
      return n;
    });
    setActiveProductRow(null);
    setProductSearch('');
    focusField(rowIndex, 'batch');
  };

  const goToNextRow = useCallback((currentRow: number) => {
    const nextRow = currentRow + 1;
    setItems(prev => {
      if (nextRow >= prev.length) return [...prev, emptyItem()];
      return prev;
    });
    focusField(nextRow, 'product');
  }, []);

  const removeItem = (i: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, idx) => idx !== i));
  };

  // Calculations
  let subtotal = 0, totalGst = 0;
  const validItems = items.filter(i => i.itemName);
  validItems.forEach(item => {
    const taxable = item.quantity * item.purchaseRate;
    subtotal += taxable;
    totalGst += taxable * (item.gstPercentage / 100);
  });
  const total = subtotal + totalGst;

  const handleSubmit = async () => {
    const filledItems = items.filter(i => i.itemName);
    if (!filledItems.length) { toast.error('Add at least one item'); return; }
    if (filledItems.some(i => i.purchaseRate <= 0)) { toast.error('All items must have a valid rate'); return; }
    if (filledItems.some(i => !i.batchNumber)) { toast.error('Batch number is required for all items'); return; }

    setSaving(true);
    try {
      await saveBulkPurchase({
        purchaseDate,
        supplierId: supplierId || undefined,
        supplierInvoiceNumber: supplierInvoiceNumber || undefined,
        items: filledItems.map(i => ({
          productId: i.productId!,
          itemName: i.itemName,
          batchNumber: i.batchNumber,
          expiryDate: i.expiryDate || undefined,
          quantity: i.quantity,
          freeQuantity: i.freeQuantity || undefined,
          purchaseRate: i.purchaseRate,
          mrp: i.mrp || 0,
          gstPercentage: i.gstPercentage,
          manufacturer: i.manufacturer || undefined,
          packSize: i.packSize || undefined,
        })),
      });
      toast.success('Purchase bill saved!');
      navigate('/purchases');
    } catch { toast.error('Failed to save purchase'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-full"><div className="text-muted-foreground">Loading...</div></div>;

  return (
    <div className="flex flex-col h-[100dvh] bg-background text-foreground text-sm">
      {/* Top Bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground text-xs shrink-0">
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-primary-foreground hover:bg-primary/80" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-3 h-3 mr-1" /> Back
        </Button>
        <span className="font-bold text-sm">Purchase Bill Entry</span>
        <div className="ml-auto flex items-center gap-3">
          <Input type="date" className="h-6 text-[10px] w-28 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
          <Input className="h-6 text-[10px] w-32 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground" placeholder="Supplier Invoice #" value={supplierInvoiceNumber} onChange={e => setSupplierInvoiceNumber(e.target.value)} />
        </div>
      </div>

      {/* Supplier Section */}
      <div className="border-b border-border bg-card px-3 py-2 shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-x-4 gap-y-1.5">
          <div className="relative" ref={supplierRef}>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground font-semibold w-14 shrink-0">Supplier</span>
              {selectedSupplier ? (
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <span className="font-bold text-sm text-primary truncate">{selectedSupplier.supplierName}</span>
                  <button onClick={() => setSupplierId('')} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-1 flex-1 relative">
                  <Search className="w-3 h-3 text-muted-foreground absolute left-2 z-10" />
                  <Input className="h-7 text-xs pl-7 font-semibold" placeholder="Search supplier..." value={supplierSearch}
                    onChange={e => { setSupplierSearch(e.target.value); setShowSupplierList(true); }} onFocus={() => setShowSupplierList(true)} />
                </div>
              )}
            </div>
            {showSupplierList && !supplierId && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                <table className="w-full text-[10px]">
                  <thead className="bg-primary text-primary-foreground sticky top-0">
                    <tr><th className="text-left px-2 py-1 font-semibold">Supplier Name</th><th className="text-left px-2 py-1 font-semibold hidden md:table-cell">City</th><th className="text-left px-2 py-1 font-semibold hidden md:table-cell">GSTIN</th></tr>
                  </thead>
                  <tbody>
                    {filteredSuppliers.map((s, idx) => (
                      <tr key={s.id} className={`cursor-pointer hover:bg-accent ${idx % 2 === 0 ? 'bg-accent/30' : 'bg-card'}`} onClick={() => selectSupplier(s)}>
                        <td className="px-2 py-1 font-semibold text-foreground">{s.supplierName}</td>
                        <td className="px-2 py-1 text-muted-foreground hidden md:table-cell">{[s.city, s.state].filter(Boolean).join(', ')}</td>
                        <td className="px-2 py-1 font-mono text-muted-foreground hidden md:table-cell">{s.gstin || '-'}</td>
                      </tr>
                    ))}
                    {!filteredSuppliers.length && <tr><td colSpan={3} className="px-2 py-3 text-center text-muted-foreground">No suppliers found</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-0.5 text-[10px]">
            {selectedSupplier && (<>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground w-12 shrink-0">Address</span>
                <span className="text-foreground truncate">{[selectedSupplier.address, selectedSupplier.city, selectedSupplier.state].filter(Boolean).join(', ')}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground">GSTIN: <span className="font-mono font-semibold text-foreground">{selectedSupplier.gstin || '-'}</span></span>
                <span className="text-muted-foreground">Ph: <span className="text-foreground">{selectedSupplier.phone || '-'}</span></span>
              </div>
            </>)}
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="flex-1 overflow-auto relative pb-4" onFocus={(e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT') {
          setTimeout(() => target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
        }
      }}>
        <table className="w-full text-[11px] border-collapse min-w-[900px]">
          <thead className="bg-primary text-primary-foreground sticky top-0 z-10">
            <tr>
              <th className="text-left px-1.5 py-1.5 w-7">#</th>
              <th className="text-left px-1.5 py-1.5 min-w-[180px]">Product Name</th>
              <th className="text-left px-1.5 py-1.5 w-14">Pack</th>
              <th className="text-left px-1.5 py-1.5 w-20">Company</th>
              <th className="text-left px-1.5 py-1.5 w-20">Batch *</th>
              <th className="text-left px-1.5 py-1.5 w-16">Expiry</th>
              <th className="text-right px-1.5 py-1.5 w-12">Qty</th>
              <th className="text-right px-1.5 py-1.5 w-10">Free</th>
              <th className="text-right px-1.5 py-1.5 w-16">Rate</th>
              <th className="text-right px-1.5 py-1.5 w-16">MRP</th>
              <th className="text-right px-1.5 py-1.5 w-10">GST%</th>
              <th className="text-right px-1.5 py-1.5 w-20">Amount</th>
              <th className="w-5"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const amt = item.quantity * item.purchaseRate;
              const isActive = activeProductRow === i;
              return (
                <tr key={i} className={`border-b border-border/40 ${i % 2 === 0 ? 'bg-accent/15' : 'bg-card'}`}>
                  <td className="px-1.5 py-0.5 text-muted-foreground text-[10px]">{i + 1}</td>
                  <td className="px-0.5 py-0.5 relative">
                    <Input
                      data-row={i} data-field="product"
                      className="h-6 text-[11px] font-semibold border-0 bg-transparent px-1 focus-visible:ring-1 focus-visible:ring-primary"
                      value={isActive ? productSearch : item.itemName}
                      placeholder="Type product..."
                      onChange={e => { setProductSearch(e.target.value); if (!isActive) setActiveProductRow(i); }}
                      onFocus={() => {
                        if (justSelectedRef.current) { justSelectedRef.current = false; return; }
                        setActiveProductRow(i);
                        setProductSearch(item.itemName || '');
                      }}
                      onBlur={() => {
                        setTimeout(() => {
                          setActiveProductRow(prev => {
                            if (prev === i) {
                              if (productSearch && !item.itemName) updateItem(i, 'itemName', productSearch);
                              return null;
                            }
                            return prev;
                          });
                        }, 200);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (isActive && filteredProducts.length > 0) {
                            selectProduct(i, filteredProducts[0]);
                          } else if (item.itemName) {
                            goToNextRow(i);
                          }
                        } else if (e.key === 'Escape') {
                          setActiveProductRow(null);
                        }
                      }}
                    />
                    {isActive && filteredProducts.length > 0 && (
                      <div className="fixed md:absolute z-50 md:top-full left-0 right-0 md:right-auto bottom-0 md:bottom-auto md:left-0 md:w-[500px] md:mt-0.5 bg-card border border-border rounded-t-xl md:rounded shadow-xl max-h-[40vh] md:max-h-52 overflow-y-auto">
                        <table className="w-full text-[10px]">
                          <thead className="bg-primary text-primary-foreground sticky top-0">
                            <tr>
                              <th className="text-left px-1.5 py-1">Product</th>
                              <th className="text-left px-1.5 py-1 w-12">Pack</th>
                              <th className="text-left px-1.5 py-1 w-16">Mfr</th>
                              <th className="text-right px-1.5 py-1 w-14">MRP</th>
                              <th className="text-right px-1.5 py-1 w-14">Rate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredProducts.map((p, idx) => (
                              <tr key={p.id}
                                className={`cursor-pointer hover:bg-primary/10 ${idx === 0 ? 'bg-primary/5 ring-1 ring-inset ring-primary/30' : idx % 2 === 0 ? 'bg-accent/30' : ''}`}
                                onMouseDown={e => { e.preventDefault(); selectProduct(i, p); }}>
                                <td className="px-1.5 py-0.5 font-semibold">{p.productName}</td>
                                <td className="px-1.5 py-0.5 text-muted-foreground">{p.packSize || '-'}</td>
                                <td className="px-1.5 py-0.5 text-muted-foreground truncate">{p.manufacturer || '-'}</td>
                                <td className="px-1.5 py-0.5 text-right font-mono">{p.mrp ? p.mrp.toFixed(2) : '-'}</td>
                                <td className="px-1.5 py-0.5 text-right font-mono">{p.unitPrice ? p.unitPrice.toFixed(2) : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </td>
                  <CellInput row={i} field="pack" value={item.packSize} onChange={v => updateItem(i, 'packSize', v)} onEnter={() => goToNextRow(i)} />
                  <CellInput row={i} field="mfr" value={item.manufacturer} onChange={v => updateItem(i, 'manufacturer', v)} onEnter={() => goToNextRow(i)} />
                  <CellInput row={i} field="batch" value={item.batchNumber} onChange={v => updateItem(i, 'batchNumber', v)} mono onEnter={() => focusField(i, 'expiry')} />
                  <CellInput row={i} field="expiry" value={item.expiryDate} onChange={v => updateItem(i, 'expiryDate', v)} placeholder="MM/YY" onEnter={() => focusField(i, 'qty')} />
                  <CellInput row={i} field="qty" value={item.quantity || ''} onChange={v => updateItem(i, 'quantity', Number(v))} type="number" align="right" bold onEnter={() => focusField(i, 'free')} />
                  <CellInput row={i} field="free" value={item.freeQuantity || ''} onChange={v => updateItem(i, 'freeQuantity', Number(v))} type="number" align="right" onEnter={() => focusField(i, 'rate')} />
                  <CellInput row={i} field="rate" value={item.purchaseRate || ''} onChange={v => updateItem(i, 'purchaseRate', Number(v))} type="number" align="right" mono onEnter={() => focusField(i, 'mrp')} />
                  <CellInput row={i} field="mrp" value={item.mrp || ''} onChange={v => updateItem(i, 'mrp', Number(v))} type="number" align="right" mono onEnter={() => focusField(i, 'gst')} />
                  <CellInput row={i} field="gst" value={item.gstPercentage || ''} onChange={v => updateItem(i, 'gstPercentage', Number(v))} type="number" align="right" onEnter={() => goToNextRow(i)} />
                  <td className="px-1.5 py-0.5 text-right font-mono font-bold text-[11px]">{item.itemName ? amt.toFixed(2) : ''}</td>
                  <td className="px-0.5">
                    {items.length > 1 && item.itemName && (
                      <button onClick={() => removeItem(i)} className="text-destructive hover:text-destructive/80"><X className="w-3 h-3" /></button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bottom Summary */}
      <div className="border-t border-border bg-card shrink-0">
        <div className="px-3 py-2 flex flex-wrap items-end gap-x-4 gap-y-2 justify-between">
          <div className="flex items-center gap-3 text-[11px]">
            <SummaryCell label="Items" value={String(validItems.length)} bold />
            <SummaryCell label="Subtotal" value={subtotal.toFixed(2)} />
            <SummaryCell label="GST" value={totalGst.toFixed(2)} />
            <div className="border-l border-border pl-3 text-center">
              <div className="text-[9px] text-muted-foreground">Total Amount</div>
              <div className="font-bold text-lg text-primary leading-tight">{formatCurrency(Math.round(total))}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => navigate(-1)}>Cancel</Button>
            <Button size="sm" className="h-7 text-[11px]" onClick={handleSubmit} disabled={saving}>
              <Save className="w-3 h-3 mr-1" />{saving ? 'Saving...' : 'Save Purchase Bill'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CellInput({ row, field, value, onChange, type = 'text', align, mono, bold, placeholder, onEnter }: {
  row: number; field: string;
  value: string | number; onChange: (v: string) => void;
  type?: string; align?: 'right'; mono?: boolean; bold?: boolean; placeholder?: string; onEnter?: () => void;
}) {
  return (
    <td className="px-0.5 py-0.5">
      <Input
        data-row={row} data-field={field}
        className={`h-6 text-[11px] border-0 bg-transparent px-1 focus-visible:ring-1 focus-visible:ring-primary ${align === 'right' ? 'text-right' : ''} ${mono ? 'font-mono' : ''} ${bold ? 'font-bold' : ''}`}
        type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        min={type === 'number' ? 0 : undefined} step={type === 'number' ? 'any' : undefined}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onEnter?.(); } }}
      />
    </td>
  );
}

function SummaryCell({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="text-center">
      <div className="text-[9px] text-muted-foreground">{label}</div>
      <div className={`font-mono leading-tight ${bold ? 'font-bold text-primary' : ''}`}>{value}</div>
    </div>
  );
}
