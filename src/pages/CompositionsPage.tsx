import React, { useState, useEffect, useMemo } from 'react';
import {
  getCompositions,
  saveComposition,
  deleteComposition,
  linkCompositionProducts,
  getProducts,
} from 'zite-endpoints-sdk';
import {
  Layers,
  Plus,
  Search,
  Trash2,
  Edit2,
  Package,
  CheckCircle2,
  X,
  AlertTriangle,
  FileSpreadsheet,
  Building2,
  MapPin,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import ProductLinkingModal from '@/components/ProductLinkingModal';

export default function CompositionsPage() {
  const [compositions, setCompositions] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Selected Composition for viewing detail
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingComp, setEditingComp] = useState<any | null>(null);
  const [compNameInput, setCompNameInput] = useState('');
  const [compCategoryInput, setCompCategoryInput] = useState('');
  const [compDescInput, setCompDescInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Link products modal state
  const [linkModalTarget, setLinkModalTarget] = useState<any | null>(null);

  // Delete confirmation modal state
  const [deletingComp, setDeletingComp] = useState<any | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [compRes, prodRes] = await Promise.all([
        getCompositions({}),
        getProducts({ limit: 1000 }),
      ]);
      setCompositions(compRes.compositions || []);
      setAllProducts(prodRes.products || []);

      // If we have a selected composition, auto-select the first one if null or refresh it
      if (compRes.compositions?.length > 0 && !selectedCompId) {
        setSelectedCompId(compRes.compositions[0].id);
      }
    } catch (err: any) {
      toast.error('Failed to load composition data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedComposition = useMemo(() => {
    if (!selectedCompId) return null;
    return compositions.find((c) => c.id === selectedCompId) || null;
  }, [compositions, selectedCompId]);

  // Products belonging to the selected composition
  const linkedProducts = useMemo(() => {
    if (!selectedComposition) return [];
    return allProducts.filter(
      (p) =>
        p.compositionId === selectedComposition.id ||
        (p.composition &&
          p.composition.trim().toLowerCase() ===
            selectedComposition.name?.trim().toLowerCase())
    );
  }, [allProducts, selectedComposition]);

  const filteredLinkedProducts = useMemo(() => {
    if (!productSearch.trim()) return linkedProducts;
    const q = productSearch.toLowerCase();
    return linkedProducts.filter(
      (p) =>
        p.productName?.toLowerCase().includes(q) ||
        p.manufacturer?.toLowerCase().includes(q) ||
        p.hsnSacCode?.toLowerCase().includes(q)
    );
  }, [linkedProducts, productSearch]);

  const filteredCompositions = useMemo(() => {
    if (!search.trim()) return compositions;
    const q = search.toLowerCase();
    return compositions.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.category?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q)
    );
  }, [compositions, search]);

  const handleOpenCreateModal = (comp?: any) => {
    if (comp) {
      setEditingComp(comp);
      setCompNameInput(comp.name || '');
      setCompCategoryInput(comp.category || '');
      setCompDescInput(comp.description || '');
    } else {
      setEditingComp(null);
      setCompNameInput('');
      setCompCategoryInput('');
      setCompDescInput('');
    }
    setIsCreateModalOpen(true);
  };

  const handleSaveCompositionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compNameInput.trim()) {
      toast.error('Composition name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await saveComposition({
        id: editingComp?.id,
        name: compNameInput.trim(),
        category: compCategoryInput.trim(),
        description: compDescInput.trim(),
      });

      toast.success(
        editingComp
          ? 'Composition updated successfully'
          : 'Composition created successfully'
      );
      setIsCreateModalOpen(false);
      await loadData();
      if (res.composition?.id) {
        setSelectedCompId(res.composition.id);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save composition');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCompositionConfirm = async () => {
    if (!deletingComp) return;
    setIsSubmitting(true);
    try {
      await deleteComposition({ id: deletingComp.id });
      toast.success(`Composition "${deletingComp.name}" deleted`);
      setDeletingComp(null);
      if (selectedCompId === deletingComp.id) {
        setSelectedCompId(null);
      }
      await loadData();
    } catch (err: any) {
      toast.error('Failed to delete composition');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlinkProduct = async (productId: string, productName: string) => {
    if (!selectedComposition) return;
    try {
      await linkCompositionProducts({
        compositionId: selectedComposition.id,
        compositionName: selectedComposition.name,
        productIdsToRemove: [productId],
      });
      toast.success(`Removed "${productName}" from ${selectedComposition.name}`);
      await loadData();
    } catch (err: any) {
      toast.error('Failed to remove product');
    }
  };

  const handleSaveLinkProducts = async (selectedProductIds: string[]) => {
    if (!linkModalTarget) return;

    // Currently linked IDs for this target
    const currentLinked = allProducts
      .filter(
        (p) =>
          p.compositionId === linkModalTarget.id ||
          (p.composition &&
            p.composition.trim().toLowerCase() ===
              linkModalTarget.name?.trim().toLowerCase())
      )
      .map((p) => p.id);

    const toAdd = selectedProductIds.filter((id) => !currentLinked.includes(id));
    const toRemove = currentLinked.filter((id) => !selectedProductIds.includes(id));

    await linkCompositionProducts({
      compositionId: linkModalTarget.id,
      compositionName: linkModalTarget.name,
      productIdsToAdd: toAdd,
      productIdsToRemove: toRemove,
    });

    await loadData();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Layers className="w-7 h-7 text-primary" />
            Composition Master
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Group generic chemical formulas (e.g. Paracetamol, Azithromycin) and link related brand products.
          </p>
        </div>
        <Button onClick={() => handleOpenCreateModal()} className="shadow-sm">
          <Plus className="w-4 h-4 mr-2" /> Create Composition
        </Button>
      </div>

      {/* Main Grid Layout: Left List, Right Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Compositions List */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-xs">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search compositions..."
                className="pl-9 bg-background"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>{filteredCompositions.length} Compositions</span>
              <span>Total Products: {allProducts.length}</span>
            </div>
          </div>

          {/* List items */}
          <div className="space-y-2.5 max-h-[70vh] overflow-y-auto pr-1">
            {isLoading ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                Loading compositions...
              </div>
            ) : filteredCompositions.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center space-y-3">
                <Layers className="w-10 h-10 mx-auto text-muted-foreground/40" />
                <p className="text-sm font-medium">No compositions found</p>
                <p className="text-xs text-muted-foreground">
                  Click "Create Composition" to add your first composition.
                </p>
              </div>
            ) : (
              filteredCompositions.map((comp) => {
                const isSelected = selectedCompId === comp.id;
                const pCount = comp.productCount ?? 0;

                return (
                  <div
                    key={comp.id}
                    onClick={() => setSelectedCompId(comp.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer relative group ${
                      isSelected
                        ? 'bg-primary/5 border-primary shadow-xs'
                        : 'bg-card border-border hover:border-primary/50 hover:bg-accent/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm text-foreground truncate">
                            {comp.name}
                          </h3>
                          <Badge
                            variant={pCount > 0 ? 'secondary' : 'outline'}
                            className="text-xs font-mono py-0 px-2"
                          >
                            {pCount} Product{pCount === 1 ? '' : 's'}
                          </Badge>
                        </div>
                        {comp.category && (
                          <p className="text-xs text-muted-foreground font-medium">
                            Category: {comp.category}
                          </p>
                        )}
                        {comp.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {comp.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenCreateModal(comp);
                          }}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingComp(comp);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Composition Details & Linked Products */}
        <div className="lg:col-span-7">
          {selectedComposition ? (
            <div className="bg-card border border-border rounded-xl p-6 space-y-6 shadow-xs sticky top-6">
              {/* Composition Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wider font-semibold text-primary">
                      Composition Details
                    </span>
                    <Badge variant="outline" className="text-xs">
                      ID: {selectedComposition.id.slice(0, 8)}
                    </Badge>
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mt-1">
                    {selectedComposition.name}
                  </h2>
                  {selectedComposition.category && (
                    <p className="text-xs text-muted-foreground mt-1 font-medium">
                      Category: {selectedComposition.category}
                    </p>
                  )}
                  {selectedComposition.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedComposition.description}
                    </p>
                  )}
                </div>

                <Button
                  onClick={() => setLinkModalTarget(selectedComposition)}
                  className="bg-primary text-primary-foreground shadow-xs shrink-0"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Add Products
                </Button>
              </div>

              {/* Linked Products Header */}
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-foreground">Linked Products</h3>
                    <Badge className="bg-primary/15 text-primary border-primary/30 font-semibold px-2.5 py-0.5">
                      Total Products: {linkedProducts.length}
                    </Badge>
                  </div>

                  {linkedProducts.length > 0 && (
                    <div className="w-full sm:w-64">
                      <Input
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Search linked products..."
                        className="h-8 text-xs bg-background"
                      />
                    </div>
                  )}
                </div>

                {/* Linked Products List */}
                {linkedProducts.length === 0 ? (
                  <div className="border border-dashed border-border rounded-xl p-8 text-center space-y-3 bg-muted/20">
                    <Package className="w-10 h-10 mx-auto text-muted-foreground/40" />
                    <p className="text-sm font-medium">No products linked yet</p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Click the "Add Products" button above to select and link medicines to{' '}
                      <span className="font-semibold text-foreground">{selectedComposition.name}</span>.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLinkModalTarget(selectedComposition)}
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add Products Now
                    </Button>
                  </div>
                ) : filteredLinkedProducts.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    No linked products match "{productSearch}"
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                    {filteredLinkedProducts.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border bg-background hover:bg-accent/30 transition-colors"
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-foreground">
                                {p.productName}
                              </span>
                              {p.manufacturer && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Building2 className="w-3 h-3" /> {p.manufacturer}
                                </span>
                              )}
                              {p.hsnSacCode && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] py-0 px-1.5 font-mono"
                                >
                                  HSN: {p.hsnSacCode}
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1 flex-wrap">
                              {p.rackLocation && (
                                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                  <MapPin className="w-3 h-3" /> Loc: {p.rackLocation}
                                </span>
                              )}
                              <span className="font-medium text-foreground">
                                MRP: ₹{p.mrp ?? p.unitPrice ?? 0}
                              </span>
                              <span>
                                Stock:{' '}
                                <span
                                  className={`font-semibold ${
                                    (p.stockQuantity ?? 0) <= 5
                                      ? 'text-destructive'
                                      : 'text-foreground'
                                  }`}
                                >
                                  {p.stockQuantity ?? 0}
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnlinkProduct(p.id, p.productName)}
                          className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8"
                        >
                          <X className="w-3.5 h-3.5 mr-1" /> Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-12 text-center space-y-3">
              <Layers className="w-12 h-12 mx-auto text-muted-foreground/30" />
              <p className="text-base font-semibold">Select a Composition</p>
              <p className="text-xs text-muted-foreground">
                Choose a composition from the left list to view and manage its linked products.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Product Linking Popup Modal */}
      {linkModalTarget && (
        <ProductLinkingModal
          isOpen={!!linkModalTarget}
          onClose={() => setLinkModalTarget(null)}
          title={`Link Products to ${linkModalTarget.name}`}
          targetId={linkModalTarget.id}
          targetName={linkModalTarget.name}
          mode="composition"
          allProducts={allProducts}
          currentlyLinkedProductIds={allProducts
            .filter(
              (p) =>
                p.compositionId === linkModalTarget.id ||
                (p.composition &&
                  p.composition.trim().toLowerCase() ===
                    linkModalTarget.name?.trim().toLowerCase())
            )
            .map((p) => p.id)}
          onSave={handleSaveLinkProducts}
        />
      )}

      {/* Create / Edit Composition Dialog Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                {editingComp ? 'Edit Composition' : 'New Composition'}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <form onSubmit={handleSaveCompositionSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Composition Name <span className="text-destructive">*</span>
                </label>
                <Input
                  value={compNameInput}
                  onChange={(e) => setCompNameInput(e.target.value)}
                  placeholder="e.g. Paracetamol or Amoxicillin + Clavulanic Acid"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Category / Group (Optional)
                </label>
                <Input
                  value={compCategoryInput}
                  onChange={(e) => setCompCategoryInput(e.target.value)}
                  placeholder="e.g. Analgesic, Antibiotic, Antipyretic"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Description / Notes (Optional)
                </label>
                <textarea
                  value={compDescInput}
                  onChange={(e) => setCompDescInput(e.target.value)}
                  placeholder="Additional notes, dosage format or usage instructions..."
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : editingComp ? 'Update' : 'Save Composition'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingComp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-bold text-base">Delete Composition?</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete composition{' '}
              <span className="font-semibold text-foreground">"{deletingComp.name}"</span>? Products linked
              to this composition will be unlinked.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setDeletingComp(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteCompositionConfirm}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
