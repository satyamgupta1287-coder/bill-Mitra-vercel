import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getCustomers, getStock, saveInvoice, getCompany, getUserSettings, getInvoiceDetail } from 'zite-endpoints-sdk';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ArrowLeft, Search, X, Save } from 'lucide-react';
import { formatCurrency, INDIAN_STATES } from '@/lib/utils';

type LineItem = {
  itemName: string;
  productId?: string;
  purchaseId?: string;
  hsnSacCode: string;
  quantity: number;
  freeQuantity: number;
  unit: string;
  unitPrice: number;
  mrp: number;
  gstPercentage: number;
  discountPercent: number;
  discountAmount: number; // flat ₹ per-unit discount (for electronics)
  batchNumber: string;
  expiryDate: string;
  manufacturer: string;
  packSize: string;
};

const emptyItem = (): LineItem => ({
  itemName: '', hsnSacCode: '', quantity: 1, freeQuantity: 0, unit: 'Nos',
  unitPrice: 0, mrp: 0, gstPercentage: 12, discountPercent: 0, discountAmount: 0,
  batchNumber: '', expiryDate: '', manufacturer: '', packSize: '',
});

type StockItem = {
  id: string;
  productName: string;
  manufacturer: string;
  packSize: string;
  hsnSacCode: string;
  gstPercentage: number;
  unitPrice: number;
  mrp: number;
  batchNumber?: string;
  expiryDate?: string;
  currentStock?: number;
  purchaseRate?: number;
  isProduct?: boolean;
};

// Template category determines which columns show in the product entry form
type TemplateCategory = 'pharma' | 'general' | 'electronics' | 'restaurant' | 'grocery' | 'furniture' | 'services' | 'retail';

function getTemplateCategory(templateName: string): TemplateCategory {
  switch (templateName) {
    case 'Classic GST':
    case 'Retail Invoice':
    case 'Wholesale Invoice':
    case 'Delivery Challan':
    case 'Modern GST':
    case 'Tax Invoice Premium':
      return 'pharma';
    case 'Electronics / Mobile':
      return 'electronics';
    case 'Restaurant / Food':
      return 'restaurant';
    case 'Grocery / Kirana':
    case 'Indian Retail Bill':
      return 'grocery';
    case 'Furniture / Hardware':
      return 'furniture';
    case 'Services Invoice':
      return 'services';
    
    case 'Thermal Receipt':
      return 'retail';
    default: // Modern GST, General GST, Tax Invoice Premium, Proforma
      return 'general';
  }
}

// Define which columns are visible per template category
type ColumnConfig = {
  pack: boolean; manufacturer: boolean; mrp: boolean; free: boolean;
  batch: boolean; expiry: boolean; hsn: boolean; disc: boolean;
  gst: boolean; unit: boolean;
  // Labels
  batchLabel: string; expiryLabel: string; manufacturerLabel: string; packLabel: string;
};

function getColumnConfig(cat: TemplateCategory): ColumnConfig {
  switch (cat) {
    case 'pharma':
      return { pack: true, manufacturer: true, mrp: true, free: true, batch: true, expiry: true, hsn: true, disc: true, gst: true, unit: false, batchLabel: 'Batch', expiryLabel: 'Expiry', manufacturerLabel: 'Company', packLabel: 'Pack' };
    case 'electronics':
      return { pack: false, manufacturer: true, mrp: true, free: false, batch: true, expiry: true, hsn: true, disc: true, gst: true, unit: false, batchLabel: 'IMEI/Serial', expiryLabel: 'Warranty', manufacturerLabel: 'Brand', packLabel: 'Pack' };
    case 'restaurant':
      return { pack: false, manufacturer: false, mrp: false, free: false, batch: false, expiry: false, hsn: false, disc: false, gst: true, unit: false, batchLabel: 'Batch', expiryLabel: 'Expiry', manufacturerLabel: 'Company', packLabel: 'Pack' };
    case 'grocery':
      return { pack: false, manufacturer: false, mrp: true, free: false, batch: false, expiry: false, hsn: false, disc: false, gst: true, unit: true, batchLabel: 'Batch', expiryLabel: 'Expiry', manufacturerLabel: 'Company', packLabel: 'Pack' };
    case 'furniture':
      return { pack: true, manufacturer: true, mrp: false, free: false, batch: false, expiry: false, hsn: true, disc: false, gst: true, unit: false, batchLabel: 'Batch', expiryLabel: 'Expiry', manufacturerLabel: 'Material', packLabel: 'Size' };
    case 'services':
      return { pack: false, manufacturer: false, mrp: false, free: false, batch: false, expiry: false, hsn: true, disc: false, gst: true, unit: false, batchLabel: 'Batch', expiryLabel: 'Expiry', manufacturerLabel: 'Company', packLabel: 'Pack' };
    case 'retail':
      return { pack: false, manufacturer: false, mrp: false, free: false, batch: false, expiry: false, hsn: false, disc: false, gst: true, unit: false, batchLabel: 'Batch', expiryLabel: 'Expiry', manufacturerLabel: 'Company', packLabel: 'Pack' };
    default: // general
      return { pack: false, manufacturer: false, mrp: false, free: false, batch: false, expiry: false, hsn: true, disc: true, gst: true, unit: true, batchLabel: 'Batch', expiryLabel: 'Expiry', manufacturerLabel: 'Company', packLabel: 'Pack' };
  }
}

const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  pharma: '💊 Pharma/Medical',
  general: '📄 General GST',
  electronics: '📱 Electronics',
  restaurant: '🍽️ Restaurant',
  grocery: '🛒 Grocery',
  furniture: '🪑 Furniture/Hardware',
  services: '🔧 Services',
  retail: '🛍️ Retail',
};

function focusField(row: number, field: string) {
  setTimeout(() => {
    const el = document.querySelector(`[data-row="${row}"][data-field="${field}"]`) as HTMLInputElement | null;
    if (el) { el.focus(); el.select(); setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50); }
  }, 30);
}

export default function CreateInvoicePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [customers, setCustomers] = useState<any[]>([]);
  const [allPickItems, setAllPickItems] = useState<StockItem[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState('Classic GST');

  const [type, setType] = useState('Tax Invoice');
  const [status, setStatus] = useState('Pending');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerId, setCustomerId] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [placeOfSupplyCode, setPlaceOfSupplyCode] = useState('');
  const [transport, setTransport] = useState('');
  const [lrNumber, setLrNumber] = useState('');
  const [cases, setCases] = useState(0);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);

  const [manualName, setManualName] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualPhone, setManualPhone] = useState('');

  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerList, setShowCustomerList] = useState(false);
  const customerRef = useRef<HTMLDivElement>(null);
  const [activeProductRow, setActiveProductRow] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const justSelectedRef = useRef(false);

  const isRetail = type === 'Retail Sale';
  const category = getTemplateCategory(selectedTemplate);
  const cols = getColumnConfig(category);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getCustomers({}),
      getStock({ includeAllProducts: true }),
      getCompany({}),
      getUserSettings({}),
      id ? getInvoiceDetail({ invoiceId: id }) : Promise.resolve(null)
    ]).then(([custRes, stockRes, compRes, settingsRes, invoiceRes]) => {
      if (invoiceRes && invoiceRes.invoice) {
        const { invoice, items: invItems } = invoiceRes;
        setType(invoice.type || 'Tax Invoice');
        setStatus(invoice.status || 'Pending');
        setInvoiceDate(invoice.invoiceDate || new Date().toISOString().split('T')[0]);
        setCustomerId(Array.isArray(invoice.customer) ? invoice.customer[0] : (invoice.customer?.id || invoice.customer || ''));
        setPlaceOfSupply(invoice.placeOfSupply || '');
        setPlaceOfSupplyCode(invoice.placeOfSupplyCode || '');
        setTransport(invoice.transport || '');
        setLrNumber(invoice.lrNumber || '');
        setCases(invoice.cases || 0);
        setNotes(invoice.notes || '');
        setTerms(invoice.terms || invoice.termsAndConditions || '');
        setManualName(invoice.manualCustomerName || '');
        setManualAddress(invoice.manualCustomerAddress || '');
        setManualPhone(invoice.manualCustomerPhone || '');
        
        if (invItems && invItems.length > 0) {
          setItems(invItems.map((it: any) => ({
            ...emptyItem(),
            ...it,
            productId: Array.isArray(it.product) ? it.product[0] : (it.product?.id || it.product)
          })).concat(emptyItem()));
        }
      }
      setCustomers(custRes.customers);
      const stockIds = new Set<string>();
      const merged: StockItem[] = [];
      (stockRes.stock || []).forEach((s: any) => {
        merged.push({ ...s, isProduct: false });
        const pid = Array.isArray(s.product) ? s.product[0] : s.product;
        if (pid) stockIds.add(pid);
      });
      (stockRes.products || []).forEach((p: any) => {
        if (!stockIds.has(p.id)) {
          merged.push({ id: p.id, productName: p.productName, manufacturer: p.manufacturer, packSize: p.packSize, hsnSacCode: p.hsnSacCode, gstPercentage: p.gstPercentage, unitPrice: p.unitPrice, mrp: p.mrp, isProduct: true });
        }
      });
      setAllPickItems(merged);
      if (compRes.company) {
        setCompany(compRes.company);
        if (compRes.company.termsAndConditions) setTerms(compRes.company.termsAndConditions);
      }
      if (settingsRes.settings) {
        setSelectedTemplate(settingsRes.settings.selectedTemplate);
      }
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customerRef.current && !customerRef.current.contains(e.target as Node)) setShowCustomerList(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedCustomer = customers.find(c => c.id === customerId);
  const isInterstate = company?.stateCode && placeOfSupplyCode && company.stateCode !== placeOfSupplyCode;

  const filteredCustomers = customers.filter(c =>
    !customerSearch || c.customerName?.toLowerCase().includes(customerSearch.toLowerCase()) || c.gstin?.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const filteredPick = allPickItems.filter(s =>
    !productSearch || s.productName?.toLowerCase().includes(productSearch.toLowerCase()) || s.manufacturer?.toLowerCase().includes(productSearch.toLowerCase()) || s.batchNumber?.toLowerCase().includes(productSearch.toLowerCase())
  );

  const selectCustomer = (c: any) => {
    setCustomerId(c.id);
    setCustomerSearch('');
    setShowCustomerList(false);
    if (c.billingState) {
      const st = INDIAN_STATES.find(s => s.name === c.billingState || s.code === c.billingStateCode);
      if (st) { setPlaceOfSupply(st.name); setPlaceOfSupplyCode(st.code); }
    }
  };

  const updateItem = useCallback((i: number, field: string, value: any) => {
    setItems(prev => { const n = [...prev]; (n[i] as any)[field] = value; return n; });
  }, []);

  const selectPickItem = (rowIndex: number, s: StockItem) => {
    justSelectedRef.current = true;
    setItems(prev => {
      const n = [...prev];
      n[rowIndex] = {
        ...n[rowIndex],
        itemName: s.productName,
        productId: s.isProduct ? s.id : (Array.isArray((s as any).product) ? (s as any).product[0] : (s as any).product),
        purchaseId: s.isProduct ? undefined : s.id,
        hsnSacCode: s.hsnSacCode || '',
        mrp: s.mrp || 0,
        unitPrice: s.unitPrice || (s as any).purchaseRate || 0,
        gstPercentage: s.gstPercentage || 12,
        batchNumber: s.batchNumber || '',
        expiryDate: s.expiryDate || '',
        manufacturer: s.manufacturer || '',
        packSize: s.packSize || '',
      };
      if (rowIndex === n.length - 1) n.push(emptyItem());
      return n;
    });
    setActiveProductRow(null);
    setProductSearch('');
    focusField(rowIndex, 'qty');
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

  // Calculations — GST is EXTRACTED from inclusive price, NOT added on top
  let subtotal = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0, totalDiscount = 0;
  const validItems = items.filter(i => i.itemName);
  validItems.forEach(item => {
    const gross = item.quantity * item.unitPrice;
    let disc = 0;
    if (category === 'electronics' && item.discountAmount > 0) {
      disc = item.discountAmount * item.quantity;
    } else {
      disc = gross * (item.discountPercent / 100);
    }
    const amount = gross - disc; // GST-inclusive final price
    totalDiscount += disc;
    // Extract GST from inclusive amount
    const taxable = amount / (1 + item.gstPercentage / 100);
    const gstAmt = amount - taxable;
    subtotal += taxable;
    if (isInterstate) totalIgst += gstAmt;
    else { totalCgst += gstAmt / 2; totalSgst += gstAmt / 2; }
  });
  const preRound = subtotal + totalCgst + totalSgst + totalIgst;
  const roundOff = Math.round(preRound) - preRound;
  const total = Math.round(preRound);

  const handleSubmit = async () => {
    if (!isRetail && !customerId) { toast.error('Select a party first'); return; }
    if (isRetail && !customerId && !manualName) { toast.error('Enter customer name'); return; }
    const filledItems = items.filter(i => i.itemName);
    if (!filledItems.length) { toast.error('Add at least one item'); return; }
    if (filledItems.some(i => i.unitPrice <= 0)) { toast.error('All items must have a valid rate'); return; }

    setSaving(true);
    try {
      const result = await saveInvoice({
        invoiceId: id || undefined,
        type, status, invoiceDate,
        customerId: customerId || undefined,
        manualCustomerName: !customerId ? manualName : undefined,
        manualCustomerAddress: !customerId ? manualAddress : undefined,
        manualCustomerPhone: !customerId ? manualPhone : undefined,
        placeOfSupply: placeOfSupply || undefined, placeOfSupplyCode: placeOfSupplyCode || undefined,
        notes: notes || undefined, terms: terms || undefined,
        transport: transport || undefined, lrNumber: lrNumber || undefined,
        cases: cases || undefined,
        items: filledItems.map(i => ({
          itemName: i.itemName, productId: i.productId, purchaseId: i.purchaseId,
          hsnSacCode: i.hsnSacCode || undefined, quantity: i.quantity,
          freeQuantity: i.freeQuantity || undefined, unit: i.unit || undefined,
          unitPrice: i.unitPrice, mrp: i.mrp || undefined,
          gstPercentage: i.gstPercentage, discountPercent: i.discountPercent || undefined,
          discountAmount: (category === 'electronics' && i.discountAmount > 0) ? i.discountAmount : undefined,
          batchNumber: i.batchNumber || undefined, expiryDate: i.expiryDate || undefined,
          manufacturer: i.manufacturer || undefined, packSize: i.packSize || undefined,
        })),
      });
      toast.success('Invoice saved!');
      navigate(`/invoices/${result.invoice.id}`);
    } catch (e: any) { toast.error('Failed to create invoice: ' + (e.message || 'Unknown')); console.error(e); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-full"><div className="text-muted-foreground">Loading...</div></div>;

  // Count visible columns for min-width
  const visibleCols = 3 + [cols.pack, cols.manufacturer, cols.mrp, cols.unit, cols.free, cols.batch, cols.expiry, cols.disc, cols.gst].filter(Boolean).length;
  const tableMinW = Math.max(600, visibleCols * 70 + 200);

  return (
    <div className="flex flex-col h-[100dvh] bg-background text-foreground text-sm">
      {/* Top Bar */}
      <div className="flex flex-col bg-primary text-primary-foreground text-xs shrink-0">
        <div className="flex items-center gap-2 px-3 py-1.5">
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-primary-foreground hover:bg-primary/80" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-3 h-3 mr-1" /> Back
          </Button>
          <span className="font-bold text-sm">Sale Bill Entry</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] opacity-70 hidden md:inline">{TEMPLATE_CATEGORY_LABELS[category]}</span>
            <Input type="date" className="h-6 text-[10px] w-28 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
          </div>
        </div>
        <div className="flex overflow-x-auto px-3 pb-1.5 gap-1.5 no-scrollbar">
          {['Tax Invoice', 'Retail Sale', 'Wholesale', 'Challan'].map(t => (
            <button key={t} onClick={() => { setType(t); if (t === 'Retail Sale') setCustomerId(''); }}
              className={`px-3 py-1 rounded text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${type === t ? 'bg-primary-foreground text-primary' : 'hover:bg-primary-foreground/20'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Party Section */}
      <PartySection
        isRetail={isRetail} customerId={customerId} selectedCustomer={selectedCustomer}
        customerSearch={customerSearch} setCustomerSearch={setCustomerSearch}
        showCustomerList={showCustomerList} setShowCustomerList={setShowCustomerList}
        customerRef={customerRef} filteredCustomers={filteredCustomers}
        selectCustomer={selectCustomer} setCustomerId={setCustomerId}
        manualName={manualName} setManualName={setManualName}
        manualAddress={manualAddress} setManualAddress={setManualAddress}
        manualPhone={manualPhone} setManualPhone={setManualPhone}
        invoiceDate={invoiceDate}
      />

      {/* Items Table */}
      <div className="flex-1 overflow-auto relative pb-4" onFocus={(e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT') {
          setTimeout(() => target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
        }
      }}>
        <table className="w-full text-[11px] border-collapse" style={{ minWidth: `${tableMinW}px` }}>
          <thead className="bg-primary text-primary-foreground sticky top-0 z-10">
            <tr>
              <th className="text-left px-1.5 py-1.5 w-7">#</th>
              <th className="text-left px-1.5 py-1.5 min-w-[180px]">Product Name</th>
              {cols.hsn && <th className="text-left px-1.5 py-1.5 w-16">HSN</th>}
              {cols.pack && <th className="text-left px-1.5 py-1.5 w-14">{cols.packLabel}</th>}
              {cols.manufacturer && <th className="text-left px-1.5 py-1.5 w-20">{cols.manufacturerLabel}</th>}
              {cols.unit && <th className="text-left px-1.5 py-1.5 w-12">Unit</th>}
              {cols.mrp && <th className="text-right px-1.5 py-1.5 w-16">M.R.P.</th>}
              <th className="text-right px-1.5 py-1.5 w-12">Qty</th>
              {cols.free && <th className="text-right px-1.5 py-1.5 w-10">Free</th>}
              {cols.batch && <th className="text-left px-1.5 py-1.5 w-20">{cols.batchLabel}</th>}
              {cols.expiry && <th className="text-left px-1.5 py-1.5 w-16">{cols.expiryLabel}</th>}
              <th className="text-right px-1.5 py-1.5 w-16">Rate</th>
              {cols.disc && <th className="text-right px-1.5 py-1.5 w-14">{category === 'electronics' ? 'Disc(₹)' : 'D%'}</th>}
              {cols.gst && <th className="text-right px-1.5 py-1.5 w-10">GST%</th>}
              <th className="text-right px-1.5 py-1.5 w-20">Amount</th>
              <th className="w-5"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const amt = (() => {
                const g = item.quantity * item.unitPrice;
                if (category === 'electronics' && item.discountAmount > 0) return g - item.discountAmount * item.quantity;
                return g * (1 - item.discountPercent / 100);
              })();
              const isActive = activeProductRow === i;
              return (
                <tr key={i} className={`border-b border-border/40 ${i % 2 === 0 ? 'bg-accent/15' : 'bg-card'}`}>
                  <td className="px-1.5 py-0.5 text-muted-foreground text-[10px]">{i + 1}</td>
                  {/* Product name cell with dropdown */}
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
                          if (isActive && filteredPick.length > 0) selectPickItem(i, filteredPick[0]);
                          else if (item.itemName) goToNextRow(i);
                        } else if (e.key === 'Escape') setActiveProductRow(null);
                      }}
                    />
                    {isActive && filteredPick.length > 0 && (
                      <ProductDropdown
                        filteredPick={filteredPick}
                        onSelect={(s) => selectPickItem(i, s)}
                        category={category}
                      />
                    )}
                  </td>
                  {cols.hsn && <CellInput row={i} field="hsn" value={item.hsnSacCode} onChange={v => updateItem(i, 'hsnSacCode', v)} mono onEnter={() => goToNextRow(i)} />}
                  {cols.pack && <CellInput row={i} field="pack" value={item.packSize} onChange={v => updateItem(i, 'packSize', v)} onEnter={() => goToNextRow(i)} />}
                  {cols.manufacturer && <CellInput row={i} field="mfr" value={item.manufacturer} onChange={v => updateItem(i, 'manufacturer', v)} onEnter={() => goToNextRow(i)} />}
                  {cols.unit && <CellInput row={i} field="unit" value={item.unit} onChange={v => updateItem(i, 'unit', v)} onEnter={() => goToNextRow(i)} />}
                  {cols.mrp && <CellInput row={i} field="mrp" value={item.mrp || ''} onChange={v => updateItem(i, 'mrp', Number(v))} type="number" align="right" mono onEnter={() => goToNextRow(i)} />}
                  <CellInput row={i} field="qty" value={item.quantity || ''} onChange={v => updateItem(i, 'quantity', Number(v))} type="number" align="right" bold onEnter={() => goToNextRow(i)} />
                  {cols.free && <CellInput row={i} field="free" value={item.freeQuantity || ''} onChange={v => updateItem(i, 'freeQuantity', Number(v))} type="number" align="right" onEnter={() => goToNextRow(i)} />}
                  {cols.batch && <CellInput row={i} field="batch" value={item.batchNumber} onChange={v => updateItem(i, 'batchNumber', v)} mono onEnter={() => goToNextRow(i)} />}
                  {cols.expiry && <CellInput row={i} field="expiry" value={item.expiryDate} onChange={v => updateItem(i, 'expiryDate', v)} placeholder="MM/YY" onEnter={() => goToNextRow(i)} />}
                  <CellInput row={i} field="rate" value={item.unitPrice || ''} onChange={v => updateItem(i, 'unitPrice', Number(v))} type="number" align="right" mono onEnter={() => goToNextRow(i)} />
                  {cols.disc && (
                    category === 'electronics'
                      ? <CellInput row={i} field="discAmt" value={item.discountAmount || ''} onChange={v => updateItem(i, 'discountAmount', Number(v))} type="number" align="right" onEnter={() => goToNextRow(i)} />
                      : <CellInput row={i} field="disc" value={item.discountPercent || ''} onChange={v => updateItem(i, 'discountPercent', Number(v))} type="number" align="right" onEnter={() => goToNextRow(i)} />
                  )}
                  {cols.gst && <CellInput row={i} field="gst" value={item.gstPercentage || ''} onChange={v => updateItem(i, 'gstPercentage', Number(v))} type="number" align="right" onEnter={() => goToNextRow(i)} />}
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
        {allPickItems.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-xs">
            <p className="font-semibold mb-1">No products found</p>
            <p>Add products in the Products page, or add purchases in Purchases page to see stock here.</p>
            <p className="mt-2">You can also type product names manually in the table above.</p>
          </div>
        )}
      </div>

      {/* Bottom Summary */}
      <BottomSummary
        items={items} validItems={validItems} isInterstate={isInterstate}
        totalDiscount={totalDiscount} totalCgst={totalCgst} totalSgst={totalSgst} totalIgst={totalIgst}
        roundOff={roundOff} total={total}
        transport={transport} setTransport={setTransport}
        lrNumber={lrNumber} setLrNumber={setLrNumber}
        cases={cases} setCases={setCases}
        saving={saving} handleSubmit={handleSubmit} navigate={navigate}
        category={category} cols={cols}
      />
    </div>
  );
}

// ─── Product Dropdown ───
function ProductDropdown({ filteredPick, onSelect, category }: { filteredPick: StockItem[]; onSelect: (s: StockItem) => void; category: TemplateCategory }) {
  const showBatch = category === 'pharma' || category === 'electronics';
  return (
    <div className="fixed md:absolute z-50 md:top-full left-0 right-0 md:right-auto bottom-0 md:bottom-auto md:left-0 md:w-[550px] md:mt-0.5 bg-card border border-border rounded-t-xl md:rounded shadow-xl max-h-[40vh] md:max-h-52 overflow-y-auto">
      <table className="w-full text-[10px]">
        <thead className="bg-primary text-primary-foreground sticky top-0">
          <tr>
            <th className="text-left px-1.5 py-1">Product</th>
            <th className="text-left px-1.5 py-1 w-12">Pack</th>
            {showBatch && <th className="text-left px-1.5 py-1 w-16">{category === 'electronics' ? 'Serial' : 'Batch'}</th>}
            <th className="text-left px-1.5 py-1 w-16">Mfr</th>
            <th className="text-right px-1.5 py-1 w-14">MRP</th>
            <th className="text-right px-1.5 py-1 w-12">Stock</th>
          </tr>
        </thead>
        <tbody>
          {filteredPick.slice(0, 50).map((s, idx) => (
            <tr key={`${s.id}-${s.batchNumber || 'p'}`}
              className={`cursor-pointer hover:bg-primary/10 ${idx === 0 ? 'bg-primary/5 ring-1 ring-inset ring-primary/30' : idx % 2 === 0 ? 'bg-accent/30' : ''}`}
              onMouseDown={e => { e.preventDefault(); onSelect(s); }}>
              <td className="px-1.5 py-0.5 font-semibold">{s.productName}</td>
              <td className="px-1.5 py-0.5 text-muted-foreground">{s.packSize || '-'}</td>
              {showBatch && <td className="px-1.5 py-0.5 font-mono text-muted-foreground">{s.batchNumber || '-'}</td>}
              <td className="px-1.5 py-0.5 text-muted-foreground truncate">{s.manufacturer || '-'}</td>
              <td className="px-1.5 py-0.5 text-right font-mono">{s.mrp ? s.mrp.toFixed(2) : '-'}</td>
              <td className={`px-1.5 py-0.5 text-right font-bold ${s.isProduct ? 'text-muted-foreground' : 'text-primary'}`}>{s.isProduct ? '∞' : (s.currentStock ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {filteredPick.length > 50 && (
        <p className="text-[10px] text-muted-foreground text-center py-1">
          Showing 50 of {filteredPick.length} — type more to narrow search
        </p>
      )}
    </div>
  );
}

// ─── Party Section ───
function PartySection({ isRetail, customerId, selectedCustomer, customerSearch, setCustomerSearch, showCustomerList, setShowCustomerList, customerRef, filteredCustomers, selectCustomer, setCustomerId, manualName, setManualName, manualAddress, setManualAddress, manualPhone, setManualPhone, invoiceDate }: any) {
  return (
    <div className="border-b border-border bg-card px-3 py-2 shrink-0">
      {isRetail && !customerId ? (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr_auto] gap-x-4 gap-y-1.5 items-center">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground font-semibold w-10 shrink-0">Party</span>
            <Input className="h-7 text-xs font-bold" placeholder="Customer name (walk-in)" value={manualName} onChange={(e: any) => setManualName(e.target.value)} autoFocus />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 flex-1">
              <span className="text-[10px] text-muted-foreground shrink-0">Addr</span>
              <Input className="h-7 text-[11px]" placeholder="Address" value={manualAddress} onChange={(e: any) => setManualAddress(e.target.value)} />
            </div>
            <div className="flex items-center gap-1 w-36">
              <span className="text-[10px] text-muted-foreground shrink-0">Ph</span>
              <Input className="h-7 text-[11px]" placeholder="Phone" value={manualPhone} onChange={(e: any) => setManualPhone(e.target.value)} />
            </div>
          </div>
          <Button variant="link" size="sm" className="text-[10px] h-6" onClick={() => setShowCustomerList(true)}>or select saved party</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-x-4 gap-y-1.5">
          <div className="relative" ref={customerRef}>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground font-semibold w-10 shrink-0">Party</span>
              {selectedCustomer ? (
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <span className="font-bold text-sm text-primary truncate">{selectedCustomer.customerName}</span>
                  <button onClick={() => setCustomerId('')} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-1 flex-1 relative">
                  <Search className="w-3 h-3 text-muted-foreground absolute left-2 z-10" />
                  <Input className="h-7 text-xs pl-7 font-semibold" placeholder="Search party name..." value={customerSearch}
                    onChange={(e: any) => { setCustomerSearch(e.target.value); setShowCustomerList(true); }} onFocus={() => setShowCustomerList(true)} />
                </div>
              )}
            </div>
            {showCustomerList && !customerId && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                <table className="w-full text-[10px]">
                  <thead className="bg-destructive text-destructive-foreground sticky top-0">
                    <tr><th className="text-left px-2 py-1 font-semibold">Party Name</th><th className="text-left px-2 py-1 font-semibold hidden md:table-cell">Address</th><th className="text-left px-2 py-1 font-semibold hidden md:table-cell">GSTIN</th></tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((c: any, idx: number) => (
                      <tr key={c.id} className={`cursor-pointer hover:bg-accent ${idx % 2 === 0 ? 'bg-accent/30' : 'bg-card'}`} onClick={() => selectCustomer(c)}>
                        <td className="px-2 py-1 font-semibold text-foreground">{c.customerName}</td>
                        <td className="px-2 py-1 text-muted-foreground hidden md:table-cell truncate max-w-[200px]">{[c.billingAddress, c.billingCity, c.billingState].filter(Boolean).join(', ')}</td>
                        <td className="px-2 py-1 font-mono text-muted-foreground hidden md:table-cell">{c.gstin || '-'}</td>
                      </tr>
                    ))}
                    {!filteredCustomers.length && <tr><td colSpan={3} className="px-2 py-3 text-center text-muted-foreground">No parties found</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-0.5 text-[10px]">
            {selectedCustomer && (<>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground w-12 shrink-0">Address</span>
                <span className="text-foreground truncate">{[selectedCustomer.billingAddress, selectedCustomer.billingCity, selectedCustomer.billingState].filter(Boolean).join(', ')}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground">GSTIN: <span className="font-mono font-semibold text-foreground">{selectedCustomer.gstin || '-'}</span></span>
                <span className="text-muted-foreground">Ph: <span className="text-foreground">{selectedCustomer.phone || '-'}</span></span>
              </div>
            </>)}
          </div>
          <div className="text-[10px] text-muted-foreground"><span>Date: {new Date(invoiceDate).toLocaleDateString('en-IN')}</span></div>
        </div>
      )}
    </div>
  );
}

// ─── Bottom Summary ───
function BottomSummary({ items, validItems, isInterstate, totalDiscount, totalCgst, totalSgst, totalIgst, roundOff, total, transport, setTransport, lrNumber, setLrNumber, cases, setCases, saving, handleSubmit, navigate, category, cols }: any) {
  return (
    <div className="border-t border-border bg-card shrink-0">
      {validItems.length > 0 && (() => {
        const last = [...items].reverse().find((i: any) => i.itemName);
        if (!last) return null;
        return (
          <div className="px-3 py-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[10px] border-b border-border/50 bg-accent/20">
            <span><b>{last.itemName}</b></span>
            {cols.pack && last.packSize && <span className="text-muted-foreground">{cols.packLabel}: {last.packSize}</span>}
            {cols.batch && last.batchNumber && <span className="text-muted-foreground">{cols.batchLabel}: <span className="font-mono">{last.batchNumber}</span></span>}
            {cols.mrp && last.mrp > 0 && <span className="text-muted-foreground">MRP: ₹{last.mrp.toFixed(2)}</span>}
            {cols.expiry && last.expiryDate && <span className="text-muted-foreground">{cols.expiryLabel}: {last.expiryDate}</span>}
            <span className="text-muted-foreground">Rate: ₹{last.unitPrice.toFixed(2)}</span>
            {cols.gst && <span className="text-muted-foreground">GST: {last.gstPercentage}%</span>}
          </div>
        );
      })()}
      <div className="px-3 py-2 flex flex-wrap items-end gap-x-4 gap-y-2 justify-between">
        {(category === 'pharma' || category === 'general') && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Transport</span>
              <Input className="h-5 w-24 text-[10px]" value={transport} onChange={(e: any) => setTransport(e.target.value)} />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">LR</span>
              <Input className="h-5 w-16 text-[10px]" value={lrNumber} onChange={(e: any) => setLrNumber(e.target.value)} />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Cases</span>
              <Input className="h-5 w-12 text-[10px]" type="number" value={cases || ''} onChange={(e: any) => setCases(Number(e.target.value))} />
            </div>
          </div>
        )}
        {category !== 'pharma' && category !== 'general' && <div />}
        <div className="flex items-center gap-3 text-[11px]">
          <SummaryCell label="Items" value={String(validItems.length)} bold />
          {totalDiscount > 0 && <SummaryCell label="Disc" value={totalDiscount.toFixed(2)} />}
          {!isInterstate ? (<><SummaryCell label="CGST" value={totalCgst.toFixed(2)} /><SummaryCell label="SGST" value={totalSgst.toFixed(2)} /></>) : (<SummaryCell label="IGST" value={totalIgst.toFixed(2)} />)}
          {roundOff !== 0 && <SummaryCell label="R.Off" value={`${roundOff >= 0 ? '+' : ''}${roundOff.toFixed(2)}`} />}
          <div className="border-l border-border pl-3 text-center">
            <div className="text-[9px] text-muted-foreground">Amount</div>
            <div className="font-bold text-lg text-primary leading-tight">{formatCurrency(total)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => navigate(-1)}>Cancel</Button>
          <Button size="sm" className="h-7 text-[11px]" onClick={handleSubmit} disabled={saving}>
            <Save className="w-3 h-3 mr-1" />{saving ? 'Saving...' : 'Save Bill'}
          </Button>
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
