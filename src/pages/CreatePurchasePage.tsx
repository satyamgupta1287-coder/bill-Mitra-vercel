import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getSuppliers, getProducts, getPurchases, saveBulkPurchase } from 'zite-endpoints-sdk';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ArrowLeft, Search, X, Save, Upload, Sparkles, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

type LineItem = {
  itemName: string;
  productId?: string;
  hsnSacCode: string;
  quantity: number;
  freeQuantity: number;
  purchaseRate: number;
  saleRate: number;
  mrp: number;
  gstPercentage: number;
  batchNumber: string;
  expiryDate: string;
  manufacturer: string;
  packSize: string;
};

const emptyItem = (): LineItem => ({
  itemName: '', hsnSacCode: '', quantity: 1, freeQuantity: 0,
  purchaseRate: 0, saleRate: 0, mrp: 0, gstPercentage: 12,
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
  const { purchaseNumber } = useParams<{ purchaseNumber?: string }>();
  const isEditing = Boolean(purchaseNumber);

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplierId, setSupplierId] = useState('');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);
  const [parsingAI, setParsingAI] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search states
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierList, setShowSupplierList] = useState(false);
  const supplierRef = useRef<HTMLDivElement>(null);
  const [activeProductRow, setActiveProductRow] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [selectedDropdownIndex, setSelectedDropdownIndex] = useState(0);
  const justSelectedRef = useRef(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getSuppliers({}),
      getProducts({ limit: 500 }),
      purchaseNumber ? getPurchases({}) : Promise.resolve(null),
    ]).then(([suppRes, prodRes, purRes]) => {
      const sups = suppRes.suppliers || [];
      const prods = prodRes.products || [];
      setSuppliers(sups);
      setAllProducts(prods);

      if (purchaseNumber && purRes) {
        const targetBill = purRes.bills.find((b: any) => b.purchaseNumber === purchaseNumber);
        if (targetBill) {
          if (targetBill.purchaseDate) {
            setPurchaseDate(targetBill.purchaseDate);
          }
          if (targetBill.supplierInvoiceNumber) {
            setSupplierInvoiceNumber(targetBill.supplierInvoiceNumber);
          }
          if (targetBill.supplierName) {
            const matchedSup = sups.find((s: any) => s.supplierName === targetBill.supplierName);
            if (matchedSup) setSupplierId(matchedSup.id);
          }
          if (targetBill.items && targetBill.items.length > 0) {
            const loaded: LineItem[] = targetBill.items.map((it: any) => ({
              itemName: it.productName || it.itemName || '',
              productId: it.product || it.productId,
              hsnSacCode: it.hsnSacCode || '',
              quantity: it.quantity || 1,
              freeQuantity: it.freeQuantity || 0,
              purchaseRate: it.purchaseRate || 0,
              saleRate: it.unitPrice || it.saleRate || 0,
              mrp: it.mrp || 0,
              gstPercentage: it.gstPercentage || 12,
              batchNumber: it.batchNumber || '',
              expiryDate: it.expiryDate || '',
              manufacturer: it.manufacturer || '',
              packSize: it.packSize || '',
            }));
            loaded.push(emptyItem());
            setItems(loaded);
          }
        } else {
          toast.error('Purchase bill not found');
        }
      }
    }).finally(() => setLoading(false));
  }, [purchaseNumber]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (supplierRef.current && !supplierRef.current.contains(e.target as Node)) setShowSupplierList(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N or Cmd+N -> Add new product row
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        e.stopPropagation();
        setItems(prev => {
          const nextRowIndex = prev.length;
          focusField(nextRowIndex, 'product');
          return [...prev, emptyItem()];
        });
        toast.info('New product row added (Ctrl+N)');
      }
      // Ctrl+T or Cmd+T -> Delete focused item
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
        e.preventDefault();
        e.stopPropagation();
        const activeEl = document.activeElement as HTMLElement | null;
        let targetRowIndex = -1;
        if (activeEl && activeEl.getAttribute('data-row') !== null) {
          targetRowIndex = parseInt(activeEl.getAttribute('data-row') || '-1', 10);
        }
        setItems(prev => {
          if (prev.length <= 1) {
            toast.warning('At least one row is required');
            return prev;
          }
          const delIdx = (targetRowIndex >= 0 && targetRowIndex < prev.length) ? targetRowIndex : prev.length - 1;
          const updated = prev.filter((_, idx) => idx !== delIdx);
          const nextFocus = Math.max(0, delIdx - 1);
          focusField(nextFocus, 'product');
          toast.info(`Product row ${delIdx + 1} deleted (Ctrl+T)`);
          return updated;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  const selectedSupplier = suppliers.find(s => s.id === supplierId);

  const filteredSuppliers = suppliers.filter(s =>
    !supplierSearch || s.supplierName?.toLowerCase().includes(supplierSearch.toLowerCase()) || s.gstin?.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  const filteredProducts = allProducts.filter(p =>
    !productSearch ||
    p.productName?.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.manufacturer?.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.composition?.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.rackLocation?.toLowerCase().includes(productSearch.toLowerCase())
  );

  const availableRacks = Array.from(new Set(allProducts.map(p => p.rackLocation).filter(Boolean)));
  const availableCompositions = Array.from(new Set(allProducts.map(p => p.composition).filter(Boolean)));

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
        purchaseRate: (p as any).purchaseRate || p.unitPrice || 0,
        saleRate: p.unitPrice || p.mrp || 0,
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsingAI(true);
    toast.info('Analyzing invoice with AI...', { id: 'ai-parse' });

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
             ctx.drawImage(img, 0, 0, width, height);
          }
          
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          const base64Data = compressedDataUrl.split(',')[1];

          try {
            const res = await fetch('/api/parse-invoice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64Data }),
          });

          const contentType = res.headers.get('content-type');
          if (!res.ok) {
            let errorMsg = 'Failed to parse invoice';
            if (contentType && contentType.includes('application/json')) {
               const err = await res.json();
               errorMsg = err.error || errorMsg;
            } else {
               errorMsg = await res.text();
            }
            throw new Error(errorMsg);
          }

          let data;
          if (contentType && contentType.includes('application/json')) {
             data = await res.json();
          } else {
             const text = await res.text();
             throw new Error(`Server returned non-JSON: ${text.substring(0, 50)}...`);
          }
          
          if (data.supplierName) {
            // Try to match supplier
            const matched = suppliers.find(s => s.supplierName.toLowerCase().includes(data.supplierName.toLowerCase()));
            if (matched) {
              setSupplierId(matched.id);
            } else {
              setSupplierSearch(data.supplierName);
              setShowSupplierList(true);
            }
          }

          if (data.invoiceNumber) setSupplierInvoiceNumber(data.invoiceNumber);
          if (data.purchaseDate) {
            const date = new Date(data.purchaseDate);
            if (!isNaN(date.getTime())) setPurchaseDate(date.toISOString().split('T')[0]);
          }

          if (data.items && Array.isArray(data.items) && data.items.length > 0) {
            const newItems: LineItem[] = data.items.map((aiItem: any) => {
              // Try to find matching product
              let matchedProd = allProducts.find(p => p.productName.toLowerCase() === aiItem.itemName?.toLowerCase());
              
              if (!matchedProd) {
                 // Try partial match
                 matchedProd = allProducts.find(p => aiItem.itemName && p.productName.toLowerCase().includes(aiItem.itemName.toLowerCase()));
              }

              const qty = Number(aiItem.quantity) || 1;
              const gst = aiItem.gstPercentage !== undefined ? Number(aiItem.gstPercentage) : (matchedProd?.gstPercentage ?? 12);
              const printedRate = Number(aiItem.printedRate) || Number(aiItem.purchaseRate) || 0;
              const disPct = Number(aiItem.discountPercent) || Number(data.tradeDiscountPercent) || 0;

              let purRate = 0;
              if (aiItem.purchaseRate && (!disPct || disPct === 0)) {
                purRate = Number(aiItem.purchaseRate);
              } else if (printedRate > 0) {
                purRate = printedRate * (1 - disPct / 100);
              }

              if (!purRate && aiItem.lineTotal) {
                const lineTot = Number(aiItem.lineTotal);
                purRate = (lineTot / (1 + gst / 100)) / qty;
              }

              purRate = Number(purRate.toFixed(2));

              return {
                itemName: aiItem.itemName || '',
                productId: matchedProd?.id,
                hsnSacCode: aiItem.hsnSacCode || matchedProd?.hsnSacCode || '',
                quantity: qty,
                freeQuantity: Number(aiItem.freeQuantity) || 0,
                purchaseRate: purRate,
                saleRate: Number(aiItem.saleRate) || Number(aiItem.unitPrice) || matchedProd?.unitPrice || Number((purRate * 1.15).toFixed(2)) || 0,
                mrp: Number(aiItem.mrp) || matchedProd?.mrp || Number((purRate * 1.25).toFixed(2)) || 0,
                gstPercentage: gst,
                batchNumber: aiItem.batchNumber || '',
                expiryDate: aiItem.expiryDate || '',
                manufacturer: aiItem.manufacturer || matchedProd?.manufacturer || '',
                packSize: aiItem.packSize || matchedProd?.packSize || '',
              };
            });
            newItems.push(emptyItem());
            setItems(newItems);
            toast.success('Invoice data populated successfully!', { id: 'ai-parse' });
          } else {
            toast.warning('Parsed invoice but found no items.', { id: 'ai-parse' });
          }
        } catch (error: any) {
          toast.error(error.message || 'Error processing invoice', { id: 'ai-parse' });
        } finally {
          setParsingAI(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
        }; // end img.onload
        img.src = evt.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast.error('Failed to parse image', { id: 'ai-parse' });
      setParsingAI(false);
    }
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
        existingPurchaseNumber: purchaseNumber || undefined,
        purchaseDate,
        supplierId: supplierId || undefined,
        supplierInvoiceNumber: supplierInvoiceNumber || undefined,
        items: filledItems.map(i => ({
          productId: i.productId || undefined,
          itemName: i.itemName,
          hsnSacCode: i.hsnSacCode || undefined,
          batchNumber: i.batchNumber,
          expiryDate: i.expiryDate || undefined,
          quantity: i.quantity,
          freeQuantity: i.freeQuantity || undefined,
          purchaseRate: i.purchaseRate,
          saleRate: i.saleRate || undefined,
          mrp: i.mrp || 0,
          gstPercentage: i.gstPercentage,
          manufacturer: i.manufacturer || undefined,
          packSize: i.packSize || undefined,
        })),
      });
      toast.success(purchaseNumber ? 'Purchase bill updated!' : 'Purchase bill saved!');
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
          <div className="flex items-center justify-end">
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
              onClick={() => fileInputRef.current?.click()}
              disabled={parsingAI}
            >
              {parsingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {parsingAI ? 'Analyzing...' : 'AI Magic Scan'}
            </Button>
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
              <th className="text-right px-1.5 py-1.5 w-16" title="Purchase Cost Rate">Pur. Rate</th>
              <th className="text-right px-1.5 py-1.5 w-16 text-blue-300 font-bold" title="Selling Rate for Invoices">Sale Rate</th>
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
                      onChange={e => { setProductSearch(e.target.value); setSelectedDropdownIndex(0); if (!isActive) setActiveProductRow(i); }}
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
                            selectProduct(i, filteredProducts[selectedDropdownIndex] || filteredProducts[0]);
                          } else if (item.itemName) {
                            const rowInputs = Array.from(document.querySelectorAll(`input[data-row="${i}"]`));
                            const currentIndex = rowInputs.indexOf(e.currentTarget as HTMLInputElement);
                            if (currentIndex >= 0 && currentIndex < rowInputs.length - 1) {
                              const nextInput = rowInputs[currentIndex + 1] as HTMLInputElement;
                              nextInput.focus();
                              nextInput.select();
                            } else goToNextRow(i);
                          }
                        } else if (e.key === 'Escape') {
                          setActiveProductRow(null);
                        } else if (e.key === 'ArrowDown') {
                          if (isActive && filteredProducts.length > 0) {
                            e.preventDefault();
                            setSelectedDropdownIndex(prev => {
                              const next = Math.min(prev + 1, filteredProducts.slice(0, 50).length - 1);
                              document.getElementById(`purchase-dropdown-item-${next}`)?.scrollIntoView({ block: 'nearest' });
                              return next;
                            });
                          } else {
                            e.preventDefault();
                            const nextInput = document.querySelector(`input[data-row="${i + 1}"][data-field="product"]`) as HTMLInputElement | null;
                            if (nextInput) { nextInput.focus(); nextInput.select(); nextInput.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
                          }
                        } else if (e.key === 'ArrowUp') {
                          if (isActive && filteredProducts.length > 0) {
                            e.preventDefault();
                            setSelectedDropdownIndex(prev => {
                              const next = Math.max(prev - 1, 0);
                              document.getElementById(`purchase-dropdown-item-${next}`)?.scrollIntoView({ block: 'nearest' });
                              return next;
                            });
                          } else {
                            e.preventDefault();
                            const prevInput = document.querySelector(`input[data-row="${i - 1}"][data-field="product"]`) as HTMLInputElement | null;
                            if (prevInput) { prevInput.focus(); prevInput.select(); prevInput.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
                          }
                        } else if (e.key === 'ArrowRight') {
                          const target = e.currentTarget;
                          const valLen = target.value.length;
                          if (target.selectionStart === valLen && target.selectionEnd === valLen) {
                            const rowInputs = Array.from(document.querySelectorAll(`input[data-row="${i}"]`));
                            const currentIndex = rowInputs.indexOf(target);
                            if (currentIndex >= 0 && currentIndex < rowInputs.length - 1) {
                              e.preventDefault();
                              const nextInput = rowInputs[currentIndex + 1] as HTMLInputElement;
                              nextInput.focus(); nextInput.select();
                            }
                          }
                        }
                      }}
                    />
                    {isActive && filteredProducts.length > 0 && (
                      <div className="fixed md:absolute z-50 md:top-full left-0 right-0 md:right-auto bottom-0 md:bottom-auto md:left-0 w-full md:w-[720px] md:mt-0.5 bg-card border-2 border-primary/50 rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[75vh] md:max-h-[480px]">
                        {(availableRacks.length > 0 || availableCompositions.length > 0) && (
                          <div className="p-2 bg-muted/90 border-b border-border space-y-1.5 text-[10px] sticky top-0 z-20 shrink-0">
                            {availableRacks.length > 0 && (
                              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
                                <span className="font-bold text-amber-600 dark:text-amber-400 shrink-0">📍 Quick Rack:</span>
                                {availableRacks.slice(0, 8).map(rack => (
                                  <button
                                    key={rack}
                                    type="button"
                                    onMouseDown={e => { e.preventDefault(); setProductSearch(rack!); }}
                                    className="px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-950 dark:hover:bg-amber-900 dark:text-amber-200 font-bold border border-amber-300 dark:border-amber-700 shrink-0 cursor-pointer"
                                  >
                                    Rack {rack}
                                  </button>
                                ))}
                              </div>
                            )}
                            {availableCompositions.length > 0 && (
                              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
                                <span className="font-bold text-blue-600 dark:text-blue-400 shrink-0">🧪 Quick Formula:</span>
                                {availableCompositions.slice(0, 8).map(comp => (
                                  <button
                                    key={comp}
                                    type="button"
                                    onMouseDown={e => { e.preventDefault(); setProductSearch(comp!); }}
                                    className="px-1.5 py-0.5 rounded bg-blue-100 hover:bg-blue-200 text-blue-900 dark:bg-blue-950 dark:hover:bg-blue-900 dark:text-blue-200 font-medium border border-blue-300 dark:border-blue-700 shrink-0 cursor-pointer truncate max-w-[130px]"
                                    title={comp!}
                                  >
                                    {comp}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="overflow-y-auto flex-1 bg-card">
                          <table className="w-full text-[11px] text-left border-collapse">
                            <thead className="bg-primary text-primary-foreground sticky top-0 z-10 font-bold">
                              <tr>
                                <th className="px-2 py-1.5">Product & Salt</th>
                                <th className="px-2 py-1.5 w-16">Pack</th>
                                <th className="px-2 py-1.5 w-20">Location</th>
                                <th className="px-2 py-1.5 w-24">Company</th>
                                <th className="px-2 py-1.5 w-20 text-right">MRP</th>
                                <th className="px-2 py-1.5 w-20 text-right">Sale Rate</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredProducts.slice(0, 50).map((p, idx) => {
                                const isSelected = idx === selectedDropdownIndex;
                                return (
                                  <tr key={p.id}
                                    id={`purchase-dropdown-item-${idx}`}
                                    className={`cursor-pointer border-b border-border/30 transition-colors ${
                                      isSelected
                                        ? 'bg-blue-600 text-white dark:bg-cyan-600 font-bold'
                                        : idx % 2 === 0 ? 'bg-accent/20 hover:bg-primary/10' : 'bg-card hover:bg-primary/10'
                                    }`}
                                    onMouseDown={e => { e.preventDefault(); selectProduct(i, p); }}>
                                    <td className="px-2 py-1 font-semibold">
                                      <div className="flex items-center gap-1.5">
                                        <span>{p.productName}</span>
                                        {p.scheduleDrug && (
                                          <span className={`text-[8px] px-1 rounded font-black border ${isSelected ? 'bg-red-500 text-white border-white' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border-red-300'}`}>
                                            Rx
                                          </span>
                                        )}
                                      </div>
                                      {p.composition && (
                                        <div className={`text-[9px] truncate max-w-[220px] font-normal ${isSelected ? 'text-cyan-100' : 'text-muted-foreground'}`}>
                                          🧪 {p.composition}
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-2 py-1">{p.packSize || '-'}</td>
                                    <td className="px-2 py-1 text-[10px]">
                                      {p.rackLocation ? (
                                        <span className={`px-1.5 py-0.5 rounded font-bold ${isSelected ? 'bg-blue-700 text-white' : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'}`}>
                                          📍 {p.rackLocation}
                                        </span>
                                      ) : '-'}
                                    </td>
                                    <td className="px-2 py-1 truncate">{p.manufacturer || '-'}</td>
                                    <td className="px-2 py-1 text-right font-mono">{p.mrp ? `₹${p.mrp.toFixed(2)}` : '-'}</td>
                                    <td className="px-2 py-1 text-right font-mono">{p.unitPrice ? `₹${p.unitPrice.toFixed(2)}` : '-'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* ValueSoft-style Live Product Status Footer */}
                        {filteredProducts[selectedDropdownIndex] && (
                          <div className="bg-slate-900 text-slate-100 p-2.5 border-t-2 border-primary/60 text-[11px] shrink-0 shadow-inner">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2">
                                <span className="bg-cyan-500/20 text-cyan-300 font-black px-1.5 py-0.5 rounded text-[9px] uppercase border border-cyan-500/40 tracking-wider">
                                  SELECTED PURCHASE PRODUCT
                                </span>
                                <span className="font-extrabold text-xs text-white tracking-wide">{filteredProducts[selectedDropdownIndex].productName}</span>
                                {filteredProducts[selectedDropdownIndex].scheduleDrug && (
                                  <span className="bg-red-500 text-white font-bold text-[9px] px-1 rounded">Rx (Schedule H)</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 font-mono text-[11px]">
                                <span>MRP: <strong className="text-emerald-400 text-xs">₹{filteredProducts[selectedDropdownIndex].mrp ? filteredProducts[selectedDropdownIndex].mrp.toFixed(2) : '0.00'}</strong></span>
                                <span>Sale Rate: <strong className="text-cyan-300 text-xs font-extrabold">₹{filteredProducts[selectedDropdownIndex].unitPrice ? filteredProducts[selectedDropdownIndex].unitPrice.toFixed(2) : '0.00'}</strong></span>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] pt-1 border-t border-slate-800 text-slate-300">
                              <div><span className="text-slate-400 font-semibold">Pack:</span> <span className="font-medium text-white">{filteredProducts[selectedDropdownIndex].packSize || '1x1'}</span></div>
                              <div><span className="text-slate-400 font-semibold">HSN Code:</span> <span className="font-mono text-cyan-300 font-bold">{filteredProducts[selectedDropdownIndex].hsnSacCode || 'N/A'}</span></div>
                              <div><span className="text-slate-400 font-semibold">GST %:</span> <span className="font-mono text-emerald-300 font-bold">{filteredProducts[selectedDropdownIndex].gstPercentage || 12}%</span></div>
                              <div><span className="text-slate-400 font-semibold">Company:</span> <span className="font-medium text-white">{filteredProducts[selectedDropdownIndex].manufacturer || 'N/A'}</span></div>
                            </div>
                            {(filteredProducts[selectedDropdownIndex].composition || filteredProducts[selectedDropdownIndex].rackLocation) && (
                              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] bg-slate-950/80 px-2 py-1 rounded border border-slate-800 mt-1">
                                {filteredProducts[selectedDropdownIndex].composition && <span className="text-cyan-300"><strong className="text-slate-400">Salt Formula:</strong> {filteredProducts[selectedDropdownIndex].composition}</span>}
                                {filteredProducts[selectedDropdownIndex].rackLocation && <span className="text-amber-300 font-bold ml-auto"><strong className="text-slate-400">Rack Location:</strong> 📍 {filteredProducts[selectedDropdownIndex].rackLocation}</span>}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <CellInput row={i} field="pack" value={item.packSize} onChange={v => updateItem(i, 'packSize', v)} onEnter={() => goToNextRow(i)} />
                  <CellInput row={i} field="mfr" value={item.manufacturer} onChange={v => updateItem(i, 'manufacturer', v)} onEnter={() => goToNextRow(i)} />
                  <CellInput row={i} field="batch" value={item.batchNumber} onChange={v => updateItem(i, 'batchNumber', v)} mono onEnter={() => focusField(i, 'expiry')} />
                  <CellInput row={i} field="expiry" value={item.expiryDate} onChange={v => updateItem(i, 'expiryDate', v)} placeholder="MM/YY" onEnter={() => focusField(i, 'qty')} />
                  <CellInput row={i} field="qty" value={item.quantity || ''} onChange={v => updateItem(i, 'quantity', Number(v))} type="number" align="right" bold onEnter={() => focusField(i, 'free')} />
                  <CellInput row={i} field="free" value={item.freeQuantity || ''} onChange={v => updateItem(i, 'freeQuantity', Number(v))} type="number" align="right" onEnter={() => focusField(i, 'rate')} />
                  <CellInput row={i} field="rate" value={item.purchaseRate || ''} onChange={v => updateItem(i, 'purchaseRate', Number(v))} type="number" align="right" mono onEnter={() => focusField(i, 'saleRate')} />
                  <CellInput row={i} field="saleRate" value={item.saleRate || ''} onChange={v => updateItem(i, 'saleRate', Number(v))} type="number" align="right" mono onEnter={() => focusField(i, 'mrp')} />
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
        onKeyDown={e => {
          const target = e.currentTarget;
          if (e.key === 'Enter') {
            e.preventDefault();
            const rowInputs = Array.from(document.querySelectorAll(`input[data-row="${row}"]`));
            const currentIndex = rowInputs.indexOf(target);
            if (currentIndex >= 0 && currentIndex < rowInputs.length - 1) {
              const nextInput = rowInputs[currentIndex + 1] as HTMLInputElement;
              nextInput.focus();
              nextInput.select();
            } else {
              onEnter?.();
            }
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const nextInput = document.querySelector(`input[data-row="${row + 1}"][data-field="${field}"]`) as HTMLInputElement | null;
            if (nextInput) {
              nextInput.focus();
              nextInput.select();
              nextInput.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevInput = document.querySelector(`input[data-row="${row - 1}"][data-field="${field}"]`) as HTMLInputElement | null;
            if (prevInput) {
              prevInput.focus();
              prevInput.select();
              prevInput.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
          } else if (e.key === 'ArrowLeft') {
            const isAtStart = target.selectionStart === 0 && target.selectionEnd === 0;
            if (isAtStart || target.type === 'number') {
              const rowInputs = Array.from(document.querySelectorAll(`input[data-row="${row}"]`));
              const currentIndex = rowInputs.indexOf(target);
              if (currentIndex > 0) {
                e.preventDefault();
                const prevInput = rowInputs[currentIndex - 1] as HTMLInputElement;
                prevInput.focus();
                prevInput.select();
              }
            }
          } else if (e.key === 'ArrowRight') {
            const valLen = String(target.value || '').length;
            const isAtEnd = target.selectionStart === valLen && target.selectionEnd === valLen;
            if (isAtEnd || target.type === 'number') {
              const rowInputs = Array.from(document.querySelectorAll(`input[data-row="${row}"]`));
              const currentIndex = rowInputs.indexOf(target);
              if (currentIndex >= 0 && currentIndex < rowInputs.length - 1) {
                e.preventDefault();
                const nextInput = rowInputs[currentIndex + 1] as HTMLInputElement;
                nextInput.focus();
                nextInput.select();
              }
            }
          }
        }}
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
