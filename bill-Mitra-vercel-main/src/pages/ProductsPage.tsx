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
import { Plus, Search, Edit, Trash2, Package, Factory, Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function ProductsPage() {
  const [tab, setTab] = useState<'products' | 'manufacturers'>('products');

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex gap-1 border-b border-border">
        <button
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${tab === 'products' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          onClick={() => setTab('products')}
        >
          <Package className="w-4 h-4 inline mr-1.5" />Products
        </button>
        <button
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${tab === 'manufacturers' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          onClick={() => setTab('manufacturers')}
        >
          <Factory className="w-4 h-4 inline mr-1.5" />Manufacturers
        </button>
      </div>
      {tab === 'products' ? <ProductsTab /> : <ManufacturersTab />}
    </div>
  );
}

function ProductsTab() {
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
          <p className="text-sm text-muted-foreground">{products.length}{hasMore ? '+' : ''} items</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setUploadOpen(true)}><Upload className="w-4 h-4 mr-2" />Upload Excel</Button>
          <Button onClick={() => openDialog()}><Plus className="w-4 h-4 mr-2" />Add Product</Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search products..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); debouncedSearch(e.target.value); }} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : products.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No products found.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(p => (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Package className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{p.productName}</h3>
                      <p className="text-[10px] text-muted-foreground">{p.manufacturer ? p.manufacturer + ' • ' : ''}{p.hsnSacCode ? 'HSN: ' + p.hsnSacCode : ''}{p.packSize ? ' • ' + p.packSize : ''}</p>
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
              <div><Label>Product Name *</Label><Input name="productName" required defaultValue={editing?.productName} /></div>
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
              <div><Label>HSN/SAC Code</Label><Input name="hsnSacCode" defaultValue={editing?.hsnSacCode} /></div>
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
                  </SelectContent>
                </Select>
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

function ExcelUploadDialog({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (v: boolean) => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedProducts, setParsedProducts] = useState<any[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: { row: number; message: string }[] } | null>(null);

  const reset = () => {
    setFile(null);
    setParsedProducts([]);
    setParseErrors([]);
    setResult(null);
    setParsing(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setParseErrors([]);
    setParsedProducts([]);
    setParsing(true);

    try {
      // Upload file to cloud storage
      const { fileUrl } = await uploadFile({ data: f, filename: f.name });

      // Determine file type
      const ext = f.name.toLowerCase().split('.').pop() || '';
      const fileType = (ext === 'xlsx' || ext === 'xls') ? 'xlsx' as const : 'csv' as const;

      // Send to backend for parsing
      const res = await parseExcelProducts({ fileUrl, fileType });
      setParsedProducts(res.products);
      setParseErrors(res.errors);
    } catch {
      setParseErrors(['Failed to parse the file. Please check the format and try again.']);
    }
    setParsing(false);
  };

  const [uploadProgress, setUploadProgress] = useState(0);

  const handleUpload = async () => {
    if (parsedProducts.length === 0) return;
    setUploading(true);
    setUploadProgress(0);

    // Split into frontend chunks of 500 to avoid request size limits
    const CHUNK = 500;
    let totalCreated = 0;
    const allErrors: { row: number; message: string }[] = [];

    try {
      for (let i = 0; i < parsedProducts.length; i += CHUNK) {
        const chunk = parsedProducts.slice(i, i + CHUNK);
        const res = await bulkUploadProducts({ products: chunk });
        totalCreated += res.created;
        allErrors.push(...res.errors);
        setUploadProgress(Math.min(100, Math.round(((i + chunk.length) / parsedProducts.length) * 100)));
      }
      const finalResult = { created: totalCreated, errors: allErrors };
      setResult(finalResult);
      if (totalCreated > 0) {
        toast.success(`${totalCreated} products uploaded successfully!`);
        onSuccess();
      }
    } catch {
      toast.error('Upload failed');
    }
    setUploading(false);
  };

  const downloadTemplate = () => {
    const headers = ['Name of The Product', 'Item Code', 'Pack Size', 'COMPANY', 'M.R.P.', 'GST', 'Sale Price', 'Cl. Qnty.', 'Description'];
    const sample = 'Paracetamol 500mg,3004,10 TAB,CIPLA,30,12,25.50,100,Paracetamol tablets';
    const csv = headers.join(',') + '\n' + sample + '\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onOpenChange(false); } else { onOpenChange(true); } }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="w-5 h-5" />Upload Products from Excel / CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Download template */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">Step 1: Download the template (optional)</p>
            <p className="text-xs text-muted-foreground">Download the CSV template, or use your own Excel (.xlsx) file with matching column headers.</p>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-2" />Download Template
            </Button>
          </div>

          {/* Upload file */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Step 2: Upload your file</p>
            <p className="text-xs text-muted-foreground">
              Accepts <strong>.xlsx</strong> and <strong>.csv</strong> files. Required column: <strong>Name of The Product</strong> (or Product Name). 
              Optional: Item Code, Pack Size, COMPANY, M.R.P., GST, Sale Price, Cl. Qnty., Description.
              Blank fields will be saved as blank.
            </p>
            <Input type="file" accept=".xlsx,.xls,.csv,.txt" onChange={handleFileChange} />
          </div>

          {/* Parsing indicator */}
          {parsing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Reading file... (large files may take a few seconds)
            </div>
          )}

          {/* Upload progress */}
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

          {/* Parse errors */}
          {parseErrors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium text-destructive flex items-center gap-1"><AlertCircle className="w-4 h-4" />Issues found</p>
              {parseErrors.slice(0, 10).map((e, i) => <p key={i} className="text-xs text-destructive">{e}</p>)}
              {parseErrors.length > 10 && <p className="text-xs text-destructive">...and {parseErrors.length - 10} more</p>}
            </div>
          )}

          {/* Preview */}
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
                        <td className="px-3 py-1.5">{p.productName}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{p.manufacturer || ''}</td>
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

          {/* Result */}
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
  const debouncedSearch = useDebouncedCallback((val: string) => load(val), 400);

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
          <h1 className="text-2xl font-bold">Manufacturers / Companies</h1>
          <p className="text-sm text-muted-foreground">{manufacturers.length} manufacturers — manage product companies here</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="w-4 h-4 mr-2" />Add Manufacturer</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search manufacturers..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); debouncedSearch(e.target.value); }} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : manufacturers.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Factory className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
          <p>No manufacturers yet. Add pharmaceutical companies like CIPLA, SUN, etc.</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {manufacturers.map(m => (
            <Card key={m.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Factory className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{m.manufacturerName}</h3>
                      {m.shortCode && <p className="text-[10px] text-muted-foreground font-mono">{m.shortCode}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(m); setDialogOpen(true); }}><Edit className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(m.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
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
            <div><Label>Manufacturer Name *</Label><Input name="manufacturerName" required defaultValue={editing?.manufacturerName} placeholder="e.g. CIPLA, SUN PHARMA" /></div>
            <div><Label>Short Code</Label><Input name="shortCode" defaultValue={editing?.shortCode} placeholder="e.g. CIP, SUN" /></div>
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
