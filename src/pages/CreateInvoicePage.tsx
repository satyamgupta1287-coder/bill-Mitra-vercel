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
  const [selectedDropdownIndex, setSelectedDropdownIndex] = useState(0);
  const justSelectedRef = useRef(false);

  const [batchModalState, setBatchModalState] = useState<{
    open: boolean;
    rowIndex: number;
    productName: string;
    batches: StockItem[];
    selectedIndex: number;
  }>({
    open: false,
    rowIndex: 0,
    productName: '',
    batches: [],
    selectedIndex: 0,
  });

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
        const invType = invoice.type || 'Tax Invoice';
        setType(invType);
        if (invoice.selectedTemplate) {
          setSelectedTemplate(invoice.selectedTemplate);
        } else if (invType === 'Wholesale') {
          setSelectedTemplate('Wholesale Invoice');
        } else if (invType === 'Challan') {
          setSelectedTemplate('Delivery Challan');
        } else if (invType === 'Retail Sale') {
          setSelectedTemplate('Retail Invoice');
        }
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
        if ((s.currentStock ?? 0) > 0) {
          merged.push({ ...s, isProduct: false });
          const pid = Array.isArray(s.product) ? s.product[0] : s.product;
          if (pid) stockIds.add(pid);
        }
      });
      (stockRes.products || []).forEach((p: any) => {
        if (!stockIds.has(p.id) && (p.stockQuantity === undefined || p.stockQuantity > 0)) {
          merged.push({ id: p.id, productName: p.productName, manufacturer: p.manufacturer, packSize: p.packSize, hsnSacCode: p.hsnSacCode, gstPercentage: p.gstPercentage, unitPrice: p.unitPrice, mrp: p.mrp, composition: p.composition, rackLocation: p.rackLocation, scheduleDrug: p.scheduleDrug, isProduct: true, currentStock: p.stockQuantity });
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

  const selectedCustomer = customers.find(c => c.id === customerId);
  const isInterstate = company?.stateCode && placeOfSupplyCode && company.stateCode !== placeOfSupplyCode;

  const isRetailCust = (c: any) => c.customerType === 'Retailer' || c.customerType === 'Retail';

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = !customerSearch ||
      c.customerName?.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.gstin?.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone?.toLowerCase().includes(customerSearch.toLowerCase());

    if (isRetail) {
      const hasRetailers = customers.some(x => isRetailCust(x));
      if (hasRetailers) {
        return matchesSearch && isRetailCust(c);
      }
      return matchesSearch;
    } else {
      return matchesSearch && !isRetailCust(c);
    }
  });

  const filteredPick = allPickItems.filter(s =>
    !productSearch || s.productName?.toLowerCase().includes(productSearch.toLowerCase()) || s.manufacturer?.toLowerCase().includes(productSearch.toLowerCase()) || s.batchNumber?.toLowerCase().includes(productSearch.toLowerCase()) || s.composition?.toLowerCase().includes(productSearch.toLowerCase()) || s.rackLocation?.toLowerCase().includes(productSearch.toLowerCase())
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

  const applySelectedItem = (rowIndex: number, s: StockItem) => {
    justSelectedRef.current = true;
    const mrpVal = s.mrp || 0;
    const saleRate = s.unitPrice || (s as any).purchaseRate || 0;
    setItems(prev => {
      const n = [...prev];
      n[rowIndex] = {
        ...n[rowIndex],
        itemName: s.productName,
        productId: s.isProduct ? s.id : (Array.isArray((s as any).product) ? (s as any).product[0] : (s as any).product),
        purchaseId: s.isProduct ? undefined : s.id,
        hsnSacCode: s.hsnSacCode || '',
        mrp: mrpVal,
        unitPrice: isRetail ? (mrpVal || saleRate) : (saleRate || mrpVal),
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

  const selectPickItem = (rowIndex: number, s: StockItem) => {
    const targetPid = s.isProduct ? s.id : (Array.isArray((s as any).product) ? (s as any).product[0] : (s as any).product);
    const targetName = (s.productName || '').trim().toLowerCase();

    // Find all active batches (currentStock > 0)
    const matchingBatches = allPickItems.filter((item: any) => {
      if (item.isProduct) return false;
      if ((item.currentStock ?? 0) <= 0) return false;
      const itemPid = Array.isArray(item.product) ? item.product[0] : item.product;
      const itemName = (item.productName || '').trim().toLowerCase();

      if (targetPid && itemPid) {
        return itemPid === targetPid;
      }
      return targetName && itemName === targetName;
    });

    if (matchingBatches.length > 1) {
      setBatchModalState({
        open: true,
        rowIndex,
        productName: s.productName,
        batches: matchingBatches,
        selectedIndex: 0,
      });
      setActiveProductRow(null);
      setProductSearch('');
    } else if (matchingBatches.length === 1) {
      applySelectedItem(rowIndex, matchingBatches[0]);
    } else {
      applySelectedItem(rowIndex, s);
    }
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
        type, selectedTemplate, status, invoiceDate,
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
            <span className="text-[10px] opacity-70 hidden lg:inline">Template:</span>
            <select
              value={selectedTemplate}
              onChange={e => setSelectedTemplate(e.target.value)}
              className="h-6 text-[10px] bg-primary-foreground/10 border border-primary-foreground/20 rounded px-1.5 text-primary-foreground focus:outline-none focus:ring-1 focus:ring-primary-foreground"
            >
              <optgroup label="Medical / Pharma">
                <option value="Classic GST" className="text-foreground bg-background">Classic GST</option>
                <option value="Modern GST" className="text-foreground bg-background">Modern GST</option>
                <option value="Retail Invoice" className="text-foreground bg-background">Retail Invoice</option>
                <option value="Wholesale Invoice" className="text-foreground bg-background">Wholesale Invoice</option>
                <option value="Delivery Challan" className="text-foreground bg-background">Delivery Challan</option>
                <option value="Tax Invoice Premium" className="text-foreground bg-background">Tax Invoice Premium</option>
              </optgroup>
              <optgroup label="General">
                <option value="General GST" className="text-foreground bg-background">General GST</option>
                <option value="Indian Retail Bill" className="text-foreground bg-background">Indian Retail Bill</option>
                <option value="Proforma Invoice" className="text-foreground bg-background">Proforma Invoice</option>
                <option value="Thermal Receipt" className="text-foreground bg-background">Thermal Receipt</option>
              </optgroup>
              <optgroup label="Industry Specific">
                <option value="Electronics / Mobile" className="text-foreground bg-background">Electronics / Mobile</option>
                <option value="Restaurant / Food" className="text-foreground bg-background">Restaurant / Food</option>
                <option value="Grocery / Kirana" className="text-foreground bg-background">Grocery / Kirana</option>
                <option value="Furniture / Hardware" className="text-foreground bg-background">Furniture / Hardware</option>
                <option value="Services Invoice" className="text-foreground bg-background">Services Invoice</option>
              </optgroup>
            </select>
            <Input type="date" className="h-6 text-[10px] w-28 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
          </div>
        </div>
        <div className="flex overflow-x-auto px-3 pb-1.5 gap-1.5 no-scrollbar items-center">
          <span className="text-[10px] opacity-75 mr-1">Bill Type:</span>
          {[
            { name: 'Tax Invoice', tmpl: 'Classic GST' },
            { name: 'Retail Sale', tmpl: 'Retail Invoice' },
            { name: 'Wholesale', tmpl: 'Wholesale Invoice' },
            { name: 'Challan', tmpl: 'Delivery Challan' },
          ].map(t => (
            <button key={t.name} onClick={() => {
              const newType = t.name;
              setType(newType);
              setSelectedTemplate(t.tmpl);
              if (newType === 'Retail Sale') {
                setCustomerId('');
                setItems(prev => prev.map(item => {
                  if (!item.itemName) return item;
                  return { ...item, unitPrice: item.mrp || item.unitPrice };
                }));
              } else {
                setItems(prev => prev.map(item => {
                  if (!item.itemName) return item;
                  if (item.productId) {
                    const match = allPickItems.find((s: any) => (s.isProduct ? s.id : (Array.isArray(s.product) ? s.product[0] : s.product)) === item.productId);
                    if (match && (match.unitPrice || (match as any).purchaseRate)) {
                      return { ...item, unitPrice: match.unitPrice || (match as any).purchaseRate };
                    }
                  }
                  return item;
                }));
              }
            }}
              className={`px-3 py-1 rounded text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${type === t.name ? 'bg-primary-foreground text-primary shadow-sm' : 'hover:bg-primary-foreground/20'}`}>
              {t.name}
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
              <th className="text-right px-1.5 py-1.5 w-16" title="Sale Rate used for item total calculation">Sale Rate</th>
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
                          if (isActive && filteredPick.length > 0) selectPickItem(i, filteredPick[selectedDropdownIndex] || filteredPick[0]);
                          else if (item.itemName) {
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
                          if (isActive && filteredPick.length > 0) {
                            e.preventDefault();
                            setSelectedDropdownIndex(prev => {
                              const next = Math.min(prev + 1, filteredPick.slice(0, 50).length - 1);
                              document.getElementById(`dropdown-item-${next}`)?.scrollIntoView({ block: 'nearest' });
                              return next;
                            });
                          } else {
                            e.preventDefault();
                            const nextInput = document.querySelector(`input[data-row="${i + 1}"][data-field="product"]`) as HTMLInputElement | null;
                            if (nextInput) { nextInput.focus(); nextInput.select(); nextInput.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
                          }
                        } else if (e.key === 'ArrowUp') {
                          if (isActive && filteredPick.length > 0) {
                            e.preventDefault();
                            setSelectedDropdownIndex(prev => {
                              const next = Math.max(prev - 1, 0);
                              document.getElementById(`dropdown-item-${next}`)?.scrollIntoView({ block: 'nearest' });
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
                    {isActive && filteredPick.length > 0 && (
                      <ProductDropdown
                        filteredPick={filteredPick}
                        allPickItems={allPickItems}
                        onSelect={(s) => selectPickItem(i, s)}
                        category={category}
                        selectedIndex={selectedDropdownIndex}
                        setProductSearch={setProductSearch}
                      />
                    )}
                  </td>
                  {cols.hsn && <CellInput row={i} field="hsn" value={item.hsnSacCode} onChange={v => updateItem(i, 'hsnSacCode', v)} mono onEnter={() => goToNextRow(i)} />}
                  {cols.pack && <CellInput row={i} field="pack" value={item.packSize} onChange={v => updateItem(i, 'packSize', v)} onEnter={() => goToNextRow(i)} />}
                  {cols.manufacturer && <CellInput row={i} field="mfr" value={item.manufacturer} onChange={v => updateItem(i, 'manufacturer', v)} onEnter={() => goToNextRow(i)} />}
                  {cols.unit && <CellInput row={i} field="unit" value={item.unit} onChange={v => updateItem(i, 'unit', v)} onEnter={() => goToNextRow(i)} />}
                  {cols.mrp && <CellInput row={i} field="mrp" value={item.mrp || ''} onChange={v => {
                    const n = Number(v);
                    updateItem(i, 'mrp', n);
                    if (isRetail) updateItem(i, 'unitPrice', n);
                  }} type="number" align="right" mono onEnter={() => goToNextRow(i)} />}
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

      {/* Batch Selection Modal */}
      <BatchSelectionModal
        open={batchModalState.open}
        productName={batchModalState.productName}
        batches={batchModalState.batches}
        selectedIndex={batchModalState.selectedIndex}
        setSelectedIndex={(idxAction) => {
          setBatchModalState(prev => ({
            ...prev,
            selectedIndex: typeof idxAction === 'function' ? idxAction(prev.selectedIndex) : idxAction
          }));
        }}
        onSelect={(selectedBatch) => {
          applySelectedItem(batchModalState.rowIndex, selectedBatch);
          setBatchModalState(prev => ({ ...prev, open: false }));
        }}
        onClose={() => {
          setBatchModalState(prev => ({ ...prev, open: false }));
        }}
        isRetail={isRetail}
      />
    </div>
  );
}

// ─── ValueSoft Style Product Selection Dropdown ───
function ProductDropdown({ filteredPick, onSelect, category, selectedIndex = 0 }: { filteredPick: StockItem[]; onSelect: (s: StockItem) => void; category: TemplateCategory; selectedIndex?: number }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const activeIdx = hoveredIdx !== null ? hoveredIdx : selectedIndex;
  const activeItem = filteredPick[activeIdx] || filteredPick[0];
  const showBatch = category === 'pharma' || category === 'electronics';

  return (
    <div className="fixed md:absolute z-50 md:top-full left-0 right-0 md:right-auto bottom-0 md:bottom-auto md:left-0 w-full md:w-[720px] md:mt-0.5 bg-card border-2 border-primary/50 rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[75vh] md:max-h-[480px]">
      {/* Top Header Bar */}
      <div className="bg-primary px-3 py-1.5 text-primary-foreground flex items-center justify-between text-xs font-bold shrink-0">
        <div className="flex items-center gap-2">
          <span>📦 All Products ({filteredPick.length})</span>
        </div>
        <span className="text-[10px] opacity-90 font-normal hidden sm:inline">Use ↑↓ keys to highlight, ENTER to select</span>
      </div>

      {/* Table List Container */}
      <div className="overflow-y-auto flex-1 bg-card">
        <table className="w-full text-[11px] text-left border-collapse">
          <thead className="bg-muted/80 text-muted-foreground sticky top-0 z-10 border-b border-border font-bold">
            <tr>
              <th className="px-2 py-1.5">Product Name</th>
              <th className="px-2 py-1.5 w-16">Pack</th>
              {showBatch && <th className="px-2 py-1.5 w-24">{category === 'electronics' ? 'Serial' : 'Batch'}</th>}
              {category === 'pharma' && <th className="px-2 py-1.5 w-20">Location</th>}
              <th className="px-2 py-1.5 w-24">Company</th>
              <th className="px-2 py-1.5 w-20 text-right">MRP</th>
              <th className="px-2 py-1.5 w-20 text-right">Sale Rate</th>
              <th className="px-2 py-1.5 w-16 text-right">Stock</th>
            </tr>
          </thead>
          <tbody>
            {filteredPick.slice(0, 50).map((s, idx) => {
              const isSelected = idx === activeIdx;
              return (
                <tr
                  key={`${s.id}-${s.batchNumber || 'p'}`}
                  id={`dropdown-item-${idx}`}
                  className={`cursor-pointer transition-colors border-b border-border/30 ${
                    isSelected
                      ? 'bg-blue-600 text-white dark:bg-cyan-600 font-bold'
                      : idx % 2 === 0 ? 'bg-accent/20 hover:bg-primary/10' : 'bg-card hover:bg-primary/10'
                  }`}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onMouseDown={e => { e.preventDefault(); onSelect(s); }}
                >
                  <td className="px-2 py-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold">{s.productName}</span>
                      {s.scheduleDrug && (
                        <span className={`text-[8px] px-1 rounded font-black border ${isSelected ? 'bg-red-500 text-white border-white' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border-red-300'}`}>
                          Rx
                        </span>
                      )}
                    </div>
                    {s.composition && (
                      <div className={`text-[9px] truncate max-w-[220px] font-normal ${isSelected ? 'text-cyan-100' : 'text-muted-foreground'}`}>
                        {s.composition}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-1">{s.packSize || '-'}</td>
                  {showBatch && (
                    <td className="px-2 py-1 font-mono">
                      <div>{s.batchNumber || '-'}</div>
                      {s.expiryDate && (
                        <div className={`text-[9px] ${isSelected ? 'text-amber-200' : 'text-muted-foreground'}`}>
                          Exp: {s.expiryDate}
                        </div>
                      )}
                    </td>
                  )}
                  {category === 'pharma' && (
                    <td className="px-2 py-1 text-[10px]">
                      {s.rackLocation ? <span className={`px-1.5 py-0.5 rounded ${isSelected ? 'bg-blue-700 text-white' : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'}`}>📍 {s.rackLocation}</span> : '-'}
                    </td>
                  )}
                  <td className="px-2 py-1 truncate">{s.manufacturer || '-'}</td>
                  <td className="px-2 py-1 text-right font-mono">
                    {s.mrp ? `₹${s.mrp.toFixed(2)}` : '-'}
                  </td>
                  <td className="px-2 py-1 text-right font-mono font-semibold">
                    {s.unitPrice ? `₹${s.unitPrice.toFixed(2)}` : (s as any).purchaseRate ? `₹${(s as any).purchaseRate.toFixed(2)}` : '-'}
                  </td>
                  <td className={`px-2 py-1 text-right font-extrabold ${isSelected ? 'text-yellow-200' : s.isProduct ? 'text-muted-foreground' : 'text-primary'}`}>
                    {s.isProduct ? '∞' : (s.currentStock ?? 0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredPick.length > 50 && (
          <p className="text-[10px] text-muted-foreground text-center py-1">
            Showing 50 of {filteredPick.length} items — type more to refine
          </p>
        )}
      </div>

      {/* ValueSoft-style Live Product Details Footer Bar */}
      {activeItem && (
        <div className="bg-slate-900 text-slate-100 p-2.5 border-t-2 border-primary/60 text-[11px] shrink-0 shadow-inner">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <span className="bg-cyan-500/20 text-cyan-300 font-black px-1.5 py-0.5 rounded text-[9px] uppercase border border-cyan-500/40 tracking-wider">
                SELECTED ITEM
              </span>
              <span className="font-extrabold text-xs text-white tracking-wide">{activeItem.productName}</span>
              {activeItem.scheduleDrug && (
                <span className="bg-red-500 text-white font-bold text-[9px] px-1 rounded">Rx (Schedule H)</span>
              )}
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span>MRP: <strong className="text-emerald-400 text-xs">₹{activeItem.mrp ? activeItem.mrp.toFixed(2) : '0.00'}</strong></span>
              <span>Sale Rate: <strong className="text-blue-300 text-xs font-bold">₹{activeItem.unitPrice ? activeItem.unitPrice.toFixed(2) : (activeItem as any).purchaseRate ? (activeItem as any).purchaseRate.toFixed(2) : '0.00'}</strong></span>
              <span>Stock: <strong className={`text-xs ${activeItem.currentStock && activeItem.currentStock < 10 ? 'text-amber-400 font-black' : 'text-cyan-300 font-extrabold'}`}>{activeItem.isProduct ? '∞ Unlimited' : (activeItem.currentStock ?? 0)}</strong></span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] pt-1 border-t border-slate-800 text-slate-300">
            <div><span className="text-slate-400 font-semibold">Pack:</span> <span className="font-medium text-white">{activeItem.packSize || '1x1'}</span></div>
            <div><span className="text-slate-400 font-semibold">Batch:</span> <span className="font-mono text-cyan-300 font-bold">{activeItem.batchNumber || 'N/A'}</span></div>
            <div><span className="text-slate-400 font-semibold">Expiry:</span> <span className={`font-mono font-bold ${activeItem.expiryDate && new Date(activeItem.expiryDate) < new Date() ? 'text-red-400 font-black' : 'text-emerald-300'}`}>{activeItem.expiryDate || 'N/A'}</span></div>
            <div><span className="text-slate-400 font-semibold">Company:</span> <span className="font-medium text-white">{activeItem.manufacturer || 'N/A'}</span></div>
          </div>
          {(activeItem.composition || activeItem.rackLocation) && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] bg-slate-950/80 px-2 py-1 rounded border border-slate-800 mt-1">
              {activeItem.composition && <span className="text-cyan-300"><strong className="text-slate-400">Salt Formula:</strong> {activeItem.composition}</span>}
              {activeItem.rackLocation && <span className="text-amber-300 font-bold ml-auto"><strong className="text-slate-400">Rack Location:</strong> 📍 {activeItem.rackLocation}</span>}
            </div>
          )}
        </div>
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
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg max-h-64 overflow-y-auto">
                <div className="px-2 py-1 bg-muted/80 text-[10px] font-bold text-muted-foreground border-b border-border flex justify-between items-center">
                  <span>{isRetail ? 'Retail Customers' : 'Wholesale / Challan Parties'}</span>
                  {!isRetail && (
                    <button onClick={() => window.open('/customers', '_blank')} className="text-primary hover:underline text-[10px] font-semibold flex items-center gap-0.5">
                      + Add Party in Customers Page
                    </button>
                  )}
                </div>
                <table className="w-full text-[10px]">
                  <thead className="bg-destructive text-destructive-foreground sticky top-0">
                    <tr><th className="text-left px-2 py-1 font-semibold">Party Name</th><th className="text-left px-2 py-1 font-semibold hidden md:table-cell">Type / GSTIN</th><th className="text-left px-2 py-1 font-semibold hidden md:table-cell">Address</th></tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((c: any, idx: number) => (
                      <tr key={c.id} className={`cursor-pointer hover:bg-accent ${idx % 2 === 0 ? 'bg-accent/30' : 'bg-card'}`} onClick={() => selectCustomer(c)}>
                        <td className="px-2 py-1 font-semibold text-foreground">
                          {c.customerName}
                          <span className="md:hidden text-[9px] block text-muted-foreground">{c.customerType || 'Wholesaler'} {c.gstin ? `• GST: ${c.gstin}` : ''}</span>
                        </td>
                        <td className="px-2 py-1 text-muted-foreground hidden md:table-cell">
                          <span className="font-semibold text-foreground">{c.customerType || 'Wholesaler'}</span>
                          {c.gstin && <span className="font-mono text-[9px] block">{c.gstin}</span>}
                        </td>
                        <td className="px-2 py-1 text-muted-foreground hidden md:table-cell truncate max-w-[200px]">{[c.billingAddress, c.billingCity, c.billingState].filter(Boolean).join(', ')}</td>
                      </tr>
                    ))}
                    {!filteredCustomers.length && (
                      <tr>
                        <td colSpan={3} className="px-3 py-4 text-center">
                          <p className="text-muted-foreground text-[11px] font-medium">
                            {isRetail ? 'No saved Retail customers found.' : 'No Wholesale / Challan party found.'}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {!isRetail ? 'Wholesale and Challan invoices require adding party details in Customers page first.' : 'Enter walk-in details above or save customer in Customers page.'}
                          </p>
                          {!isRetail && (
                            <a href="/customers" target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-xs font-bold text-primary underline hover:text-primary/80">
                              Go to Customers Page to Add Party →
                            </a>
                          )}
                        </td>
                      </tr>
                    )}
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

// ─── Batch Selection Popup Modal for Multi-Batch Products ───
function BatchSelectionModal({
  open,
  productName,
  batches,
  selectedIndex,
  onSelect,
  onClose,
  setSelectedIndex,
  isRetail,
}: {
  open: boolean;
  productName: string;
  batches: StockItem[];
  selectedIndex: number;
  onSelect: (batch: StockItem) => void;
  onClose: () => void;
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
  isRetail: boolean;
}) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => {
          const next = Math.min(prev + 1, batches.length - 1);
          document.getElementById(`batch-modal-row-${next}`)?.scrollIntoView({ block: 'nearest' });
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => {
          const next = Math.max(prev - 1, 0);
          document.getElementById(`batch-modal-row-${next}`)?.scrollIntoView({ block: 'nearest' });
          return next;
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (batches[selectedIndex]) {
          onSelect(batches[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [open, batches, selectedIndex, onSelect, onClose, setSelectedIndex]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        ref={modalRef}
        className="bg-card border-2 border-primary rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base">{productName}</span>
              <span className="bg-primary-foreground/20 text-primary-foreground text-[10px] px-2 py-0.5 rounded-full font-bold">
                {batches.length} Batches Available
              </span>
            </div>
            <p className="text-[11px] text-primary-foreground/80 mt-0.5">
              Select batch for this sale bill (Use ↑↓ arrows, press ENTER to confirm)
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-primary-foreground/80 hover:text-primary-foreground p-1 rounded-md hover:bg-primary-foreground/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Table */}
        <div className="max-h-[60vh] overflow-y-auto p-2 bg-muted/20">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-muted text-muted-foreground font-bold sticky top-0 z-10 border-b border-border">
              <tr>
                <th className="px-3 py-2">Batch No</th>
                <th className="px-3 py-2">Expiry Date</th>
                <th className="px-3 py-2 text-right">M.R.P.</th>
                <th className="px-3 py-2 text-right">{isRetail ? 'Retail Rate' : 'Purchase Rate'}</th>
                <th className="px-3 py-2 text-right">Available Stock</th>
                <th className="px-3 py-2 text-center w-20">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {batches.map((b, idx) => {
                const isSelected = idx === selectedIndex;
                const rate = isRetail ? (b.mrp || 0) : (b.unitPrice || (b as any).purchaseRate || 0);
                return (
                  <tr
                    key={b.id || idx}
                    id={`batch-modal-row-${idx}`}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                        : idx % 2 === 0
                        ? 'bg-card hover:bg-primary/10'
                        : 'bg-accent/30 hover:bg-primary/10'
                    }`}
                    onClick={() => onSelect(b)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <td className="px-3 py-2.5 font-mono font-semibold">
                      {b.batchNumber || 'N/A'}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px]">
                      {b.expiryDate ? `Exp: ${b.expiryDate}` : '-'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold">
                      ₹{b.mrp ? b.mrp.toFixed(2) : '0.00'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold">
                      ₹{rate.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                      {b.currentStock ?? 0}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        className={`text-[10px] px-2 py-1 rounded font-bold transition-colors ${
                          isSelected
                            ? 'bg-primary-foreground text-primary'
                            : 'bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(b);
                        }}
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Modal Footer */}
        <div className="bg-muted/50 px-4 py-2 text-[11px] text-muted-foreground flex items-center justify-between border-t border-border">
          <span>Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono text-[10px] font-bold text-foreground">↑</kbd> <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono text-[10px] font-bold text-foreground">↓</kbd> to navigate, <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono text-[10px] font-bold text-foreground">ENTER</kbd> to select, <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono text-[10px] font-bold text-foreground">ESC</kbd> to cancel</span>
          <Button variant="outline" size="sm" className="h-7 text-xs px-3" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
