import React, { useState, useEffect, useMemo } from 'react';
import {
  getLocations,
  saveLocation,
  deleteLocation,
  linkLocationProducts,
  getProducts,
} from 'zite-endpoints-sdk';
import {
  MapPin,
  Plus,
  Search,
  Trash2,
  Edit2,
  Package,
  CheckCircle2,
  X,
  AlertTriangle,
  Building2,
  Layers,
  Archive,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import ProductLinkingModal from '@/components/ProductLinkingModal';

const DEFAULT_LOCATION_TYPES = ['Rack', 'Shelf', 'Counter', 'Godown', 'Cold Storage', 'Drawer', 'Display'];

export default function LocationsPage() {
  const [locations, setLocations] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Selected Location for detail
  const [selectedLocId, setSelectedLocId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');

  // Create / Edit Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState<any | null>(null);
  const [locNameInput, setLocNameInput] = useState('');
  const [locTypeInput, setLocTypeInput] = useState('Rack');
  const [locDescInput, setLocDescInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Link products modal state
  const [linkModalTarget, setLinkModalTarget] = useState<any | null>(null);

  // Delete modal state
  const [deletingLoc, setDeletingLoc] = useState<any | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [locRes, prodRes] = await Promise.all([
        getLocations({}),
        getProducts({ limit: 1000 }),
      ]);
      let fetchedLocations = locRes.locations || [];

      // If database is empty, seed default standard location examples!
      if (fetchedLocations.length === 0) {
        const seedDefaults = [
          { name: 'Rack A', type: 'Rack', description: 'Main front storage rack A' },
          { name: 'Rack B', type: 'Rack', description: 'Secondary medicine rack B' },
          { name: 'Shelf 1', type: 'Shelf', description: 'Top shelf for fast-moving items' },
          { name: 'Shelf 2', type: 'Shelf', description: 'Middle shelf for tablets & capsules' },
          { name: 'Counter', type: 'Counter', description: 'Front billing counter drawer' },
          { name: 'Godown', type: 'Godown', description: 'Main backroom inventory godown' },
          { name: 'Cold Storage', type: 'Cold Storage', description: 'Refrigerated unit for insulins & vaccines' },
        ];
        for (const seed of seedDefaults) {
          await saveLocation(seed);
        }
        const reFetch = await getLocations({});
        fetchedLocations = reFetch.locations || [];
      }

      setLocations(fetchedLocations);
      setAllProducts(prodRes.products || []);

      if (fetchedLocations.length > 0 && !selectedLocId) {
        setSelectedLocId(fetchedLocations[0].id);
      }
    } catch (err: any) {
      toast.error('Failed to load product locations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedLocation = useMemo(() => {
    if (!selectedLocId) return null;
    return locations.find((l) => l.id === selectedLocId) || null;
  }, [locations, selectedLocId]);

  // Products belonging to selected location
  const linkedProducts = useMemo(() => {
    if (!selectedLocation) return [];
    return allProducts.filter(
      (p) =>
        p.locationId === selectedLocation.id ||
        (p.rackLocation &&
          p.rackLocation.trim().toLowerCase() ===
            selectedLocation.name?.trim().toLowerCase())
    );
  }, [allProducts, selectedLocation]);

  const filteredLinkedProducts = useMemo(() => {
    if (!productSearch.trim()) return linkedProducts;
    const q = productSearch.toLowerCase();
    return linkedProducts.filter(
      (p) =>
        p.productName?.toLowerCase().includes(q) ||
        p.manufacturer?.toLowerCase().includes(q) ||
        p.hsnSacCode?.toLowerCase().includes(q) ||
        p.composition?.toLowerCase().includes(q)
    );
  }, [linkedProducts, productSearch]);

  const filteredLocations = useMemo(() => {
    if (!search.trim()) return locations;
    const q = search.toLowerCase();
    return locations.filter(
      (l) =>
        l.name?.toLowerCase().includes(q) ||
        l.type?.toLowerCase().includes(q) ||
        l.description?.toLowerCase().includes(q)
    );
  }, [locations, search]);

  const handleOpenCreateModal = (loc?: any) => {
    if (loc) {
      setEditingLoc(loc);
      setLocNameInput(loc.name || '');
      setLocTypeInput(loc.type || 'Rack');
      setLocDescInput(loc.description || '');
    } else {
      setEditingLoc(null);
      setLocNameInput('');
      setLocTypeInput('Rack');
      setLocDescInput('');
    }
    setIsCreateModalOpen(true);
  };

  const handleSaveLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locNameInput.trim()) {
      toast.error('Location name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await saveLocation({
        id: editingLoc?.id,
        name: locNameInput.trim(),
        type: locTypeInput.trim(),
        description: locDescInput.trim(),
      });

      toast.success(
        editingLoc ? 'Location updated successfully' : 'Location created successfully'
      );
      setIsCreateModalOpen(false);
      await loadData();
      if (res.location?.id) {
        setSelectedLocId(res.location.id);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save location');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLocationConfirm = async () => {
    if (!deletingLoc) return;
    setIsSubmitting(true);
    try {
      await deleteLocation({ id: deletingLoc.id });
      toast.success(`Location "${deletingLoc.name}" deleted`);
      setDeletingLoc(null);
      if (selectedLocId === deletingLoc.id) {
        setSelectedLocId(null);
      }
      await loadData();
    } catch (err: any) {
      toast.error('Failed to delete location');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlinkProduct = async (productId: string, productName: string) => {
    if (!selectedLocation) return;
    try {
      await linkLocationProducts({
        locationId: selectedLocation.id,
        locationName: selectedLocation.name,
        productIdsToRemove: [productId],
      });
      toast.success(`Removed "${productName}" from ${selectedLocation.name}`);
      await loadData();
    } catch (err: any) {
      toast.error('Failed to remove product from location');
    }
  };

  const handleSaveLinkProducts = async (selectedProductIds: string[]) => {
    if (!linkModalTarget) return;

    const currentLinked = allProducts
      .filter(
        (p) =>
          p.locationId === linkModalTarget.id ||
          (p.rackLocation &&
            p.rackLocation.trim().toLowerCase() ===
              linkModalTarget.name?.trim().toLowerCase())
      )
      .map((p) => p.id);

    const toAdd = selectedProductIds.filter((id) => !currentLinked.includes(id));
    const toRemove = currentLinked.filter((id) => !selectedProductIds.includes(id));

    await linkLocationProducts({
      locationId: linkModalTarget.id,
      locationName: linkModalTarget.name,
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
            <MapPin className="w-7 h-7 text-primary" />
            Product Locations Master
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Organize storage racks, shelves, counters, godowns, and cold storage units.
          </p>
        </div>
        <Button onClick={() => handleOpenCreateModal()} className="shadow-sm">
          <Plus className="w-4 h-4 mr-2" /> Add Location
        </Button>
      </div>

      {/* Main Grid: Left Locations List, Right Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Locations List */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-xs">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search racks, shelves, godowns..."
                className="pl-9 bg-background"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>{filteredLocations.length} Storage Locations</span>
              <span>Total Products: {allProducts.length}</span>
            </div>
          </div>

          {/* List items */}
          <div className="space-y-2.5 max-h-[70vh] overflow-y-auto pr-1">
            {isLoading ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                Loading storage locations...
              </div>
            ) : filteredLocations.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center space-y-3">
                <MapPin className="w-10 h-10 mx-auto text-muted-foreground/40" />
                <p className="text-sm font-medium">No locations found</p>
                <p className="text-xs text-muted-foreground">
                  Click "Add Location" to define your store layout.
                </p>
              </div>
            ) : (
              filteredLocations.map((loc) => {
                const isSelected = selectedLocId === loc.id;
                const pCount = loc.productCount ?? 0;

                return (
                  <div
                    key={loc.id}
                    onClick={() => setSelectedLocId(loc.id)}
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
                            {loc.name}
                          </h3>
                          {loc.type && (
                            <Badge variant="outline" className="text-[11px] font-medium py-0">
                              {loc.type}
                            </Badge>
                          )}
                          <Badge
                            variant={pCount > 0 ? 'secondary' : 'outline'}
                            className="text-xs font-mono py-0 px-2 ml-auto sm:ml-0"
                          >
                            {pCount} Item{pCount === 1 ? '' : 's'}
                          </Badge>
                        </div>
                        {loc.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {loc.description}
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
                            handleOpenCreateModal(loc);
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
                            setDeletingLoc(loc);
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

        {/* Right Column: Location Details & Linked Products */}
        <div className="lg:col-span-7">
          {selectedLocation ? (
            <div className="bg-card border border-border rounded-xl p-6 space-y-6 shadow-xs sticky top-6">
              {/* Location Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wider font-semibold text-amber-600 dark:text-amber-400">
                      Storage Location
                    </span>
                    {selectedLocation.type && (
                      <Badge variant="outline" className="text-xs">
                        Type: {selectedLocation.type}
                      </Badge>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mt-1">
                    {selectedLocation.name}
                  </h2>
                  {selectedLocation.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedLocation.description}
                    </p>
                  )}
                </div>

                <Button
                  onClick={() => setLinkModalTarget(selectedLocation)}
                  className="bg-primary text-primary-foreground shadow-xs shrink-0"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Add Products
                </Button>
              </div>

              {/* Linked Products Header */}
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-foreground">Stored Medicines / Products</h3>
                    <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 font-semibold px-2.5 py-0.5">
                      Total Products: {linkedProducts.length}
                    </Badge>
                  </div>

                  {linkedProducts.length > 0 && (
                    <div className="w-full sm:w-64">
                      <Input
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Search products in this location..."
                        className="h-8 text-xs bg-background"
                      />
                    </div>
                  )}
                </div>

                {/* Stored Products List */}
                {linkedProducts.length === 0 ? (
                  <div className="border border-dashed border-border rounded-xl p-8 text-center space-y-3 bg-muted/20">
                    <Archive className="w-10 h-10 mx-auto text-muted-foreground/40" />
                    <p className="text-sm font-medium">No products assigned to this location</p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Click the "Add Products" button above to assign products to{' '}
                      <span className="font-semibold text-foreground">{selectedLocation.name}</span>.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLinkModalTarget(selectedLocation)}
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add Products Now
                    </Button>
                  </div>
                ) : filteredLinkedProducts.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    No products match "{productSearch}"
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
                              {p.composition && (
                                <span className="flex items-center gap-1">
                                  <Layers className="w-3 h-3 text-primary/70" /> Comp:{' '}
                                  {p.composition}
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
              <MapPin className="w-12 h-12 mx-auto text-muted-foreground/30" />
              <p className="text-base font-semibold">Select a Location</p>
              <p className="text-xs text-muted-foreground">
                Choose a storage rack or location from the left list to view stored products.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Product Linking Modal */}
      {linkModalTarget && (
        <ProductLinkingModal
          isOpen={!!linkModalTarget}
          onClose={() => setLinkModalTarget(null)}
          title={`Assign Products to Location: ${linkModalTarget.name}`}
          targetId={linkModalTarget.id}
          targetName={linkModalTarget.name}
          mode="location"
          allProducts={allProducts}
          currentlyLinkedProductIds={allProducts
            .filter(
              (p) =>
                p.locationId === linkModalTarget.id ||
                (p.rackLocation &&
                  p.rackLocation.trim().toLowerCase() ===
                    linkModalTarget.name?.trim().toLowerCase())
            )
            .map((p) => p.id)}
          onSave={handleSaveLinkProducts}
        />
      )}

      {/* Create / Edit Location Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                {editingLoc ? 'Edit Storage Location' : 'New Storage Location'}
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

            <form onSubmit={handleSaveLocationSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Location Name <span className="text-destructive">*</span>
                </label>
                <Input
                  value={locNameInput}
                  onChange={(e) => setLocNameInput(e.target.value)}
                  placeholder="e.g. Rack A, Shelf 2, Counter, Cold Storage"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Location Type
                </label>
                <select
                  value={locTypeInput}
                  onChange={(e) => setLocTypeInput(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {DEFAULT_LOCATION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Description / Notes (Optional)
                </label>
                <textarea
                  value={locDescInput}
                  onChange={(e) => setLocDescInput(e.target.value)}
                  placeholder="Details about capacity or section in store..."
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
                  {isSubmitting ? 'Saving...' : editingLoc ? 'Update' : 'Save Location'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingLoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-bold text-base">Delete Location?</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete storage location{' '}
              <span className="font-semibold text-foreground">"{deletingLoc.name}"</span>? Products currently
              assigned to this location will have their location unlinked.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setDeletingLoc(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteLocationConfirm}
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
