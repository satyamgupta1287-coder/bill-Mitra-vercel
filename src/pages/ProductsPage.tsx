import { useEffect, useState, useCallback } from 'react';
import { getProducts, saveProduct, deleteProduct as deleteProductApi, getManufacturers, saveManufacturer, deleteManufacturer as deleteManufacturerApi, bulkUploadProducts, parseExcelProducts } from 'zite-endpoints-sdk';
import { uploadFile } from 'zite-file-upload-sdk';
import { useDebouncedCallback } from 'use-debounce';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, Search, Edit, Trash2, Package, Factory, Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, FlaskConical, MapPin, Layers } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

import CompositionsPage from './CompositionsPage';
import LocationsPage from './LocationsPage';

export default function ProductsPage() {
  const [tab, setTab] = useState<'products' | 'compositions' | 'racks' | 'manufacturers'>('products');

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex gap-1 border-b border-border overflow-x-auto scrollbar-none">
        <button
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors shrink-0 ${tab === 'products' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          onClick={() => setTab('products')}
        >
          <Package className="w-4 h-4 inline mr-1.5" />Products & Items
        </button>
        <button
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors shrink-0 ${tab === 'compositions' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          onClick={() => setTab('compositions')}
        >
          <FlaskConical className="w-4 h-4 inline mr-1.5 text-blue-500" />Composition Master
        </button>
        <button
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors shrink-0 ${tab === 'racks' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          onClick={() => setTab('racks')}
        >
          <MapPin className="w-4 h-4 inline mr-1.5 text-amber-500" />Product Location Master
        </button>
        <button
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors shrink-0 ${tab === 'manufacturers' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          onClick={() => setTab('manufacturers')}
        >
          <Factory className="w-4 h-4 inline mr-1.5" />Manufacturers
        </button>
      </div>

      {tab === 'products' && <ProductsTab onSwitchTab={setTab} />}
      {tab === 'compositions' && <CompositionsPage />}
      {tab === 'racks' && <LocationsPage />}
      {tab === 'manufacturers' && <ManufacturersTab />}
    </div>
  );
}

function ProductsTab({ onSwitchTab }: { onSwitchTab?: (t: any) => void }) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [manufacturers, setManufacturers] = useState<any[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalLoaded, setTotalLoaded] = useState(0);
  const [selectedComposition, setSelectedComposition] = useState<string>('all');
  const [selectedRack, setSelectedRack] = useState<string>('all');

  const load = useCallback((s?: string) => {
    setLoading(true);
    getProducts({ search: s || undefined, limit: 100 }).then(r => {
      setProducts(r.products);
      setHasMore(r.hasMore);
      setTotalLoaded(r.products.length);
    }).finally(() => setLoading(false));
  }, []);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const r = await getProducts({ search: search || undefined, offset: totalLoaded, limit: 100 });
      setProducts(prev => [...prev, ...r.products]);
      setHasMore(r.hasMore);
      setTotalLoaded(prev => prev + r.products.length);
    } catch { toast.error('Failed to load more'); }
    setLoadingMore(false);
  }, [search, totalLoaded]);

  useEffect(() => { load(); }, [load]);
  const debouncedSearch = useDebouncedCallback((val: string) => { setTotalLoaded(0); load(val); }, 400);

  const openDialog = (p?: any) => {
    setEditing(p || null);
    getManufacturers({}).then(r => setManufacturers(r.manufacturers));
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: any = {};
    fd.forEach((v, k) => { if (v) data[k] = v; });
    data.unitPrice = Number(data.unitPrice);
    data.gstPercentage = Number(data.gstPercentage);
    if (data.stockQuantity) data.stockQuantity = Number(data.stockQuantity);
    if (data.mrp) data.mrp = Number(data.mrp);

    setSaving(true);
    try {
      if (editing?.id) data.id = editing.id;
      await saveProduct(data);
      toast.success(editing ? 'Product updated' : 'Product added');
      setDialogOpen(false);
      setEditing(null);
      load(search);
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const allCompositions = Array.from(new Set(products.map(p => p.composition).filter(Boolean)));
  const allRacks = Array.from(new Set(products.map(p => p.rackLocation).filter(Boolean)));

  const displayedProducts = products.filter(p => {
    if (selectedComposition !== 'all' && p.composition !== selectedComposition) return false;
    if (selectedRack !== 'all' && p.rackLocation !== selectedRack) return false;
    return true;
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteProductApi({ id: deleteId });
      setProducts(p => p.filter(x => x.id !== deleteId));
      toast.success('Product deleted');
    } catch { toast.error('Failed to delete'); }
    setDeleteId(null);
  };

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Products & Services</h1>
          <p className="text-sm text-muted-foreground">{products.length}{hasMore ? '+' : ''} items in inventory</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onSwitchTab && (
            <>
              <Button variant="outline" size="sm" onClick={() => onSwitchTab('compositions')}>
                <FlaskConical className="w-4 h-4 mr-1.5 text-blue-500" />Formula / Salt List ({allCompositions.length})
              </Button>
              <Button variant="outline" size="sm" onClick={() => onSwitchTab('racks')}>
                <MapPin className="w-4 h-4 mr-1.5 text-amber-500" />Rack Locations ({allRacks.length})
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}><Upload className="w-4 h-4 mr-1.5" />Upload Excel</Button>
          <Button size="sm" onClick={() => openDialog()}><Plus className="w-4 h-4 mr-1.5" />Add Product</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-card p-3 rounded-xl border border-border shadow-sm">
        <div className="relative max-w-xs flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search medicine, salt, rack, company..." className="pl-9 h-9 text-xs" value={search} onChange={e => { setSearch(e.target.value); debouncedSearch(e.target.value); }} />
        </div>

        {allCompositions.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground shrink-0">🧪 Formula:</span>
            <Select value={selectedComposition} onValueChange={setSelectedComposition}>
              <SelectTrigger className="h-9 text-xs w-[180px]">
                <SelectValue placeholder="All Compositions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Formulas ({allCompositions.length})</SelectItem>
                {allCompositions.map((comp: any) => (
                  <SelectItem key={comp} value={comp}>{comp}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {allRacks.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground shrink-0">📍 Rack Location:</span>
            <Select value={selectedRack} onValueChange={setSelectedRack}>
              <SelectTrigger className="h-9 text-xs w-[150px]">
                <SelectValue placeholder="All Racks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Racks ({allRacks.length})</SelectItem>
                {allRacks.map((rack: any) => (
                  <SelectItem key={rack} value={rack}>Rack {rack}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {(selectedComposition !== 'all' || selectedRack !== 'all' || search) && (
          <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground" onClick={() => { setSearch(''); setSelectedComposition('all'); setSelectedRack('all'); load(); }}>
            Clear Filters
          </Button>
        )}
      </div>

      {(selectedComposition !== 'all' || selectedRack !== 'all') && (
        <div className="flex items-center gap-2 text-xs bg-primary/10 border border-primary/20 text-primary px-3 py-1.5 rounded-lg">
          <span className="font-bold">Active Filter:</span>
          {selectedComposition !== 'all' && <span className="bg-primary/20 px-2 py-0.5 rounded font-semibold">🧪 Formula: {selectedComposition}</span>}
          {selectedRack !== 'all' && <span className="bg-primary/20 px-2 py-0.5 rounded font-semibold">📍 Rack: {selectedRack}</span>}
          <span className="ml-auto text-muted-foreground font-medium">Showing {displayedProducts.length} medicines</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : products.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No products found.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedProducts.map(p => (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Package className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-sm">{p.productName}</h3>
                        {p.scheduleDrug && (
                          <span className="text-[9px] bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 font-bold px-1 rounded border border-red-300">Rx</span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">{p.manufacturer ? p.manufacturer + ' • ' : ''}{p.hsnSacCode ? 'HSN: ' + p.hsnSacCode : ''}{p.packSize ? ' • ' + p.packSize : ''}</p>
                      
                      <div className="flex flex-wrap gap-1 mt-1">
                        {p.composition && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSelectedComposition(p.composition); }}
                            className="inline-flex items-center gap-0.5 text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950 dark:hover:bg-blue-900 dark:text-blue-300 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800 transition-colors font-medium"
                            title="Click to view all medicines with this composition/formula"
                          >
                            <span>🧪</span>
                            <span className="truncate max-w-[140px]">{p.composition}</span>
                          </button>
                        )}
                        {p.rackLocation && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSelectedRack(p.rackLocation); }}
                            className="inline-flex items-center gap-0.5 text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950 dark:hover:bg-amber-900 dark:text-amber-300 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800 transition-colors font-bold"
                            title="Click to view all medicines in this rack location"
                          >
                            <span>📍</span>
                            <span>Rack {p.rackLocation}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDialog(p)}><Edit className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Rate</span><p className="font-semibold">{formatCurrency(p.unitPrice)}</p></div>
                  <div><span className="text-muted-foreground">MRP</span><p className="font-semibold">{formatCurrency(p.mrp)}</p></div>
                  <div><span className="text-muted-foreground">GST</span><p className="font-semibold">{p.gstPercentage}%</p></div>
                  <div><span className="text-muted-foreground">Stock</span><p className="font-semibold">{p.stockQuantity || 0} {p.unit}</p></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? (
              <><div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />Loading...</>
            ) : (
              `Load More Products (${products.length} loaded)`
            )}
          </Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) { setDialogOpen(false); setEditing(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Product' : 'Add Product'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Product Name *</Label><Input name="productName" required defaultValue={editing?.productName} placeholder="e.g. Dolo 650" /></div>
              <div>
                <Label>Manufacturer</Label>
                {manufacturers.length > 0 ? (
                  <Select name="manufacturer" defaultValue={editing?.manufacturer}>
                    <SelectTrigger><SelectValue placeholder="Select manufacturer" /></SelectTrigger>
                    <SelectContent>
                      {manufacturers.map(m => <SelectItem key={m.id} value={m.manufacturerName}>{m.manufacturerName}{m.shortCode ? ` (${m.shortCode})` : ''}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input name="manufacturer" defaultValue={editing?.manufacturer} placeholder="e.g. CIPLA, SUN" />
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>HSN/SAC Code</Label><Input name="hsnSacCode" defaultValue={editing?.hsnSacCode} placeholder="e.g. 3004" /></div>
              <div><Label>Pack Size</Label><Input name="packSize" defaultValue={editing?.packSize} placeholder="e.g. 10 TAB, 100ML" /></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><Label>Selling Rate (₹) *</Label><Input name="unitPrice" type="number" step="0.01" required defaultValue={editing?.unitPrice} /></div>
              <div><Label>MRP (₹)</Label><Input name="mrp" type="number" step="0.01" defaultValue={editing?.mrp} /></div>
              <div><Label>GST % *</Label><Input name="gstPercentage" type="number" step="0.01" required defaultValue={editing?.gstPercentage} /></div>
              <div><Label>Stock Qty</Label><Input name="stockQuantity" type="number" defaultValue={editing?.stockQuantity} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Unit</Label><Input name="unit" defaultValue={editing?.unit || 'Nos'} /></div>
              <div>
                <Label>Category</Label>
                <Select name="category" defaultValue={editing?.category || 'Goods'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Goods">Goods</SelectItem>
                    <SelectItem value="Services">Services</SelectItem>
                    <SelectItem value="pharma">Pharma/Medicine</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Composition Field with Suggestions */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-blue-700 dark:text-blue-300 font-semibold flex items-center gap-1">
                  🧪 Composition / Formula (Salt)
                </Label>
                <span className="text-[10px] text-muted-foreground">Salt composition</span>
              </div>
              <Input
                name="composition"
                list="compositions-datalist"
                defaultValue={editing?.composition}
                placeholder="e.g. Paracetamol 500mg + Aceclofenac 100mg"
                className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
              />
              <datalist id="compositions-datalist">
                {allCompositions.map((comp: any) => (
                  <option key={comp} value={comp} />
                ))}
              </datalist>
              {allCompositions.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  <span className="text-[10px] font-medium text-muted-foreground shrink-0">Quick Select:</span>
                  {allCompositions.slice(0, 8).map((comp: any) => (
                    <button
                      key={comp}
                      type="button"
                      onClick={(e) => {
                        const form = e.currentTarget.closest('form');
                        if (form) {
                          const inp = form.querySelector('[name="composition"]') as HTMLInputElement;
                          if (inp) inp.value = comp;
                        }
                      }}
                      className="text-[10px] bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-950 dark:hover:bg-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded border border-blue-300 dark:border-blue-700 transition-colors truncate max-w-[150px]"
                      title={comp}
                    >
                      {comp}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Rack Location Field with Suggestions */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-1">
                  📍 Product Rack / Bin Location
                </Label>
                <span className="text-[10px] text-muted-foreground">Shelf or rack number</span>
              </div>
              <Input
                name="rackLocation"
                list="racks-datalist"
                defaultValue={editing?.rackLocation}
                placeholder="e.g. Rack A-12, Shelf 3, Drawer B"
                className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
              />
              <datalist id="racks-datalist">
                {allRacks.map((rack: any) => (
                  <option key={rack} value={rack} />
                ))}
              </datalist>
              {allRacks.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  <span className="text-[10px] font-medium text-muted-foreground shrink-0">Existing Racks:</span>
                  {allRacks.slice(0, 8).map((rack: any) => (
                    <button
                      key={rack}
                      type="button"
                      onClick={(e) => {
                        const form = e.currentTarget.closest('form');
                        if (form) {
                          const inp = form.querySelector('[name="rackLocation"]') as HTMLInputElement;
                          if (inp) inp.value = rack;
                        }
                      }}
                      className="text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-950 dark:hover:bg-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-700 transition-colors font-bold"
                    >
                      Rack {rack}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 items-center">
              <div><Label>Min Stock Level</Label><Input name="minStockLevel" type="number" defaultValue={editing?.minStockLevel} placeholder="Reorder level" /></div>
              <div className="flex items-center space-x-2 mt-4">
                <input type="checkbox" id="scheduleDrug" name="scheduleDrug" defaultChecked={editing?.scheduleDrug} className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" />
                <Label htmlFor="scheduleDrug">Schedule H/H1 Drug</Label>
              </div>
            </div>
            <div><Label>Description</Label><Textarea name="description" rows={2} defaultValue={editing?.description} /></div>
            <DialogFooter><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Product'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Product?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExcelUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} onSuccess={() => load(search)} />
    </>
  );
}

function CompositionsTab() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedComp, setSelectedComp] = useState<string | null>(null);

  useEffect(() => {
    getProducts({ limit: 500 }).then(r => setProducts(r.products)).finally(() => setLoading(false));
  }, []);

  const compositionMap: Record<string, any[]> = {};
  products.forEach(p => {
    if (p.composition) {
      const comp = p.composition.trim();
      if (!compositionMap[comp]) compositionMap[comp] = [];
      compositionMap[comp].push(p);
    }
  });

  const compositions = Object.keys(compositionMap).filter(c =>
    !search || c.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-blue-500" />
            Medicine Compositions & Formula List
          </h2>
          <p className="text-sm text-muted-foreground">
            {Object.keys(compositionMap).length} active drug formulas registered
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search formulas or salt names (e.g. Paracetamol)..."
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : compositions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground space-y-2">
            <FlaskConical className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="font-semibold">No compositions found.</p>
            <p className="text-xs">Add composition/salt details while creating or editing products.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {compositions.map(comp => {
            const list = compositionMap[comp];
            const isSelected = selectedComp === comp;
            return (
              <Card key={comp} className={`hover:shadow-md transition-all border ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : ''}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-bold px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                        🧪 Formula
                      </span>
                      <h3 className="font-bold text-sm text-foreground mt-1">{comp}</h3>
                    </div>
                    <span className="text-xs bg-muted px-2 py-1 rounded-full font-bold text-muted-foreground shrink-0">
                      {list.length} {list.length === 1 ? 'Medicine' : 'Medicines'}
                    </span>
                  </div>

                  <div className="space-y-1 pt-1">
                    <p className="text-[10px] text-muted-foreground font-semibold">Medicines with this composition:</p>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {list.map((m: any) => (
                        <div key={m.id} className="text-[11px] bg-accent/50 px-2 py-1 rounded border border-border flex items-center gap-1.5">
                          <span className="font-semibold">{m.productName}</span>
                          {m.rackLocation && (
                            <span className="text-[9px] bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 px-1 rounded font-bold">
                              📍 Rack {m.rackLocation}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground">₹{m.unitPrice}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RacksTab() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getProducts({ limit: 500 }).then(r => setProducts(r.products)).finally(() => setLoading(false));
  }, []);

  const rackMap: Record<string, any[]> = {};
  products.forEach(p => {
    if (p.rackLocation) {
      const rack = p.rackLocation.trim();
      if (!rackMap[rack]) rackMap[rack] = [];
      rackMap[rack].push(p);
    }
  });

  const racks = Object.keys(rackMap).filter(r =>
    !search || r.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-amber-500" />
            Product Rack & Bin Locations
          </h2>
          <p className="text-sm text-muted-foreground">
            {Object.keys(rackMap).length} rack locations initialized
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search rack locations (e.g. A-12, Shelf 3)..."
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : racks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground space-y-2">
            <MapPin className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="font-semibold">No rack locations assigned yet.</p>
            <p className="text-xs">Add rack location details while creating or editing products.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {racks.map(rack => {
            const list = rackMap[rack];
            return (
              <Card key={rack} className="hover:shadow-md transition-all border border-amber-200/50 dark:border-amber-900/50">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 font-bold px-2 py-0.5 rounded border border-amber-300 dark:border-amber-700">
                        📍 Location
                      </span>
                      <h3 className="font-bold text-base text-foreground mt-1">Rack {rack}</h3>
                    </div>
                    <span className="text-xs bg-muted px-2 py-1 rounded-full font-bold text-muted-foreground shrink-0">
                      {list.length} {list.length === 1 ? 'Medicine' : 'Medicines'}
                    </span>
                  </div>

                  <div className="space-y-1 pt-1">
                    <p className="text-[10px] text-muted-foreground font-semibold">Stored items in this rack:</p>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                      {list.map((m: any) => (
                        <div key={m.id} className="text-[11px] bg-accent/50 px-2 py-1 rounded border border-border flex items-center gap-1">
                          <span className="font-bold">{m.productName}</span>
                          {m.composition && (
                            <span className="text-[9px] text-blue-600 dark:text-blue-400 font-medium truncate max-w-[100px]">
                              🧪 {m.composition}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground ml-auto">Stock: {m.stockQuantity || 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ExcelUploadDialog({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (open: boolean) => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsedProducts, setParsedProducts] = useState<any[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<{ created: number; errors: any[] } | null>(null);

  const reset = () => {
    setFile(null);
    setParsedProducts([]);
    setParseErrors([]);
    setResult(null);
    setUploadProgress(0);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setParsing(true);
    setParseErrors([]);
    setParsedProducts([]);
    setResult(null);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const bytes = Array.from(new Uint8Array(buffer));
      const res = await parseExcelProducts({ fileBuffer: bytes, fileName: selectedFile.name });

      setParsedProducts(res.products);
      if (res.errors.length > 0) {
        setParseErrors(res.errors);
      }
      toast.success(`Parsed ${res.products.length} products from Excel`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to parse Excel file');
      setFile(null);
    } finally {
      setParsing(false);
    }
  };

  const handleUpload = async () => {
    if (parsedProducts.length === 0) return;

    setUploading(true);
    setUploadProgress(10);

    try {
      setUploadProgress(50);
      const res = await bulkUploadProducts({ products: parsedProducts });
      setUploadProgress(100);
      setResult({ created: res.createdCount, errors: res.errors });
      toast.success(`Successfully uploaded ${res.createdCount} products`);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) reset(); onOpenChange(val); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <FileSpreadsheet className="w-5 h-5 text-green-600" />
            Bulk Import Products via Excel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Upload an Excel (.xlsx/.xls) or CSV file containing your inventory product list.
          </p>

          <div className="border-2 border-dashed border-border rounded-xl p-6 text-center space-y-2 hover:border-primary/50 transition-colors">
            <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto" />
            <div>
              <label htmlFor="excel-file-input" className="cursor-pointer font-semibold text-primary hover:underline text-sm">
                Click to browse
              </label>
              <span className="text-sm text-muted-foreground"> or drag & drop file here</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Supports .xlsx, .xls, .csv</p>
            <input id="excel-file-input" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
            {file && <p className="text-xs font-semibold text-primary pt-1">Selected: {file.name}</p>}
          </div>

          {parsing && (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Parsing Excel file...
            </div>
          )}

          {uploading && uploadProgress > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Uploading products...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}

          {parseErrors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium text-destructive flex items-center gap-1"><AlertCircle className="w-4 h-4" />Issues found</p>
              {parseErrors.slice(0, 10).map((e, i) => <p key={i} className="text-xs text-destructive">{e}</p>)}
              {parseErrors.length > 10 && <p className="text-xs text-destructive">...and {parseErrors.length - 10} more</p>}
            </div>
          )}

          {parsedProducts.length > 0 && !result && (
            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                {parsedProducts.length} products ready to upload
              </p>
              <div className="border border-border rounded-lg overflow-x-auto max-h-48">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Product Name</th>
                      <th className="px-3 py-2 text-left">Company</th>
                      <th className="px-3 py-2 text-left">Formula</th>
                      <th className="px-3 py-2 text-left">Rack</th>
                      <th className="px-3 py-2 text-right">Rate</th>
                      <th className="px-3 py-2 text-right">MRP</th>
                      <th className="px-3 py-2 text-right">GST%</th>
                      <th className="px-3 py-2 text-right">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedProducts.slice(0, 20).map((p: any, i: number) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-1.5">{i + 1}</td>
                        <td className="px-3 py-1.5 font-semibold">{p.productName}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{p.manufacturer || ''}</td>
                        <td className="px-3 py-1.5 text-blue-600 dark:text-blue-400">{p.composition || '-'}</td>
                        <td className="px-3 py-1.5 text-amber-600 dark:text-amber-400 font-bold">{p.rackLocation || '-'}</td>
                        <td className="px-3 py-1.5 text-right">{p.unitPrice != null ? `₹${Number(p.unitPrice).toFixed(2)}` : ''}</td>
                        <td className="px-3 py-1.5 text-right">{p.mrp != null ? `₹${Number(p.mrp).toFixed(2)}` : ''}</td>
                        <td className="px-3 py-1.5 text-right">{p.gstPercentage != null ? `${p.gstPercentage}%` : ''}</td>
                        <td className="px-3 py-1.5 text-right">{p.stockQuantity != null ? p.stockQuantity : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedProducts.length > 20 && <p className="text-xs text-muted-foreground px-3 py-2">...and {parsedProducts.length - 20} more rows</p>}
              </div>
            </div>
          )}

          {result && (
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-green-700 dark:text-green-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />{result.created} products created successfully
              </p>
              {result.errors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-destructive font-medium">{result.errors.length} rows had errors:</p>
                  {result.errors.slice(0, 5).map((e, i) => <p key={i} className="text-xs text-destructive">Row {e.row}: {e.message}</p>)}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {result ? (
            <Button onClick={() => { reset(); onOpenChange(false); }}>Done</Button>
          ) : (
            <Button onClick={handleUpload} disabled={uploading || parsing || parsedProducts.length === 0}>
              {uploading ? `Uploading... ${uploadProgress}%` : `Upload ${parsedProducts.length} Products`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManufacturersTab() {
  const [manufacturers, setManufacturers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback((s?: string) => {
    setLoading(true);
    getManufacturers({ search: s || undefined }).then(r => setManufacturers(r.manufacturers)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  const debouncedSearch = useDebouncedCallback((val: string) => load(val), 300);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: any = {};
    fd.forEach((v, k) => { if (v) data[k] = v; });

    setSaving(true);
    try {
      if (editing?.id) data.id = editing.id;
      await saveManufacturer(data);
      toast.success(editing ? 'Manufacturer updated' : 'Manufacturer added');
      setDialogOpen(false);
      setEditing(null);
      load(search);
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteManufacturerApi({ id: deleteId });
      setManufacturers(m => m.filter(x => x.id !== deleteId));
      toast.success('Manufacturer deleted');
    } catch { toast.error('Failed to delete'); }
    setDeleteId(null);
  };

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Manufacturers</h1>
          <p className="text-sm text-muted-foreground">{manufacturers.length} companies registered</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="w-4 h-4 mr-2" />Add Manufacturer</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search manufacturers..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); debouncedSearch(e.target.value); }} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : manufacturers.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No manufacturers found.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {manufacturers.map(m => (
            <Card key={m.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    {m.manufacturerName}
                    {m.shortCode && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">{m.shortCode}</span>}
                  </h3>
                  {m.contactPerson && <p className="text-xs text-muted-foreground mt-1">Contact: {m.contactPerson}</p>}
                  {m.phone && <p className="text-xs text-muted-foreground">Ph: {m.phone}</p>}
                  {m.gstin && <p className="text-[10px] font-mono text-muted-foreground mt-1">GSTIN: {m.gstin}</p>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(m); setDialogOpen(true); }}><Edit className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(m.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) { setDialogOpen(false); setEditing(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit Manufacturer' : 'Add Manufacturer'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div><Label>Company Name *</Label><Input name="manufacturerName" required defaultValue={editing?.manufacturerName} placeholder="e.g. Cipla Ltd." /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Short Code</Label><Input name="shortCode" defaultValue={editing?.shortCode} placeholder="e.g. CPL" /></div>
              <div><Label>GSTIN</Label><Input name="gstin" defaultValue={editing?.gstin} placeholder="27ABCDE1234F1ZH" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Contact Person</Label><Input name="contactPerson" defaultValue={editing?.contactPerson} /></div>
              <div><Label>Phone</Label><Input name="phone" defaultValue={editing?.phone} /></div>
            </div>
            <div><Label>Email</Label><Input name="email" type="email" defaultValue={editing?.email} /></div>
            <DialogFooter><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Manufacturer'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Manufacturer?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
