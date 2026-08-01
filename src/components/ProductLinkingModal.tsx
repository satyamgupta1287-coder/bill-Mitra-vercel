import React, { useState, useEffect, useMemo } from 'react';
import { Search, Check, X, Building2, Package, Layers, MapPin, AlertCircle, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface ProductLinkingModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  targetId: string;
  targetName: string;
  mode: 'composition' | 'location';
  allProducts: any[];
  currentlyLinkedProductIds: string[];
  onSave: (selectedProductIds: string[]) => Promise<void>;
}

export default function ProductLinkingModal({
  isOpen,
  onClose,
  title,
  targetId,
  targetName,
  mode,
  allProducts,
  currentlyLinkedProductIds,
  onSave,
}: ProductLinkingModalProps) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIds(new Set(currentlyLinkedProductIds));
    }
  }, [isOpen, currentlyLinkedProductIds]);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return allProducts;
    const q = search.toLowerCase();
    return allProducts.filter((p) => {
      const nameMatch = p.productName?.toLowerCase().includes(q);
      const brandMatch = (p.manufacturer || p.brandName || '')?.toLowerCase().includes(q);
      const hsnMatch = (p.hsnSacCode || '')?.toLowerCase().includes(q);
      const compMatch = (p.composition || '')?.toLowerCase().includes(q);
      const locMatch = (p.rackLocation || '')?.toLowerCase().includes(q);
      return nameMatch || brandMatch || hsnMatch || compMatch || locMatch;
    });
  }, [allProducts, search]);

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    const next = new Set(selectedIds);
    filteredProducts.forEach((p) => next.add(p.id));
    setSelectedIds(next);
  };

  const handleDeselectAll = () => {
    const next = new Set(selectedIds);
    filteredProducts.forEach((p) => next.delete(p.id));
    setSelectedIds(next);
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await onSave(Array.from(selectedIds));
      toast.success(`Successfully updated products for "${targetName}"`);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save product links');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-muted/30">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              {mode === 'composition' ? (
                <Layers className="w-5 h-5 text-primary" />
              ) : (
                <MapPin className="w-5 h-5 text-primary" />
              )}
              {title}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Assigning products to <span className="font-semibold text-foreground">{targetName}</span>
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-lg hover:bg-accent">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Search & Bulk Select Controls */}
        <div className="p-4 border-b border-border bg-background/50 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Product Name, Brand/Manufacturer, HSN Code..."
              className="pl-9 bg-background"
              autoFocus
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleSelectAll} className="h-7 text-xs">
                <CheckSquare className="w-3.5 h-3.5 mr-1" />
                Select Filtered ({filteredProducts.length})
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDeselectAll} className="h-7 text-xs">
                <Square className="w-3.5 h-3.5 mr-1" />
                Deselect Filtered
              </Button>
            </div>
            <div className="font-medium">
              <Badge variant="secondary" className="font-mono">
                {selectedIds.size} selected
              </Badge>
            </div>
          </div>
        </div>

        {/* Products List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground space-y-2">
              <Package className="w-10 h-10 mx-auto opacity-30" />
              <p className="text-sm font-medium">No products found</p>
              <p className="text-xs">Try adjusting your search term.</p>
            </div>
          ) : (
            filteredProducts.map((p) => {
              const isChecked = selectedIds.has(p.id);

              // Check if currently assigned to another composition or location
              let existingLinkText = null;
              if (mode === 'composition') {
                const currentCompName = p.composition;
                if (currentCompName && p.compositionId !== targetId && currentCompName.trim().toLowerCase() !== targetName.trim().toLowerCase()) {
                  existingLinkText = `Already linked to ${currentCompName}`;
                }
              } else {
                const currentLocName = p.rackLocation;
                if (currentLocName && p.locationId !== targetId && currentLocName.trim().toLowerCase() !== targetName.trim().toLowerCase()) {
                  existingLinkText = `Already in ${currentLocName}`;
                }
              }

              return (
                <div
                  key={p.id}
                  onClick={() => toggleSelect(p.id)}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                    isChecked
                      ? 'bg-primary/10 border-primary shadow-2xs'
                      : 'border-border hover:bg-accent/50'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // handled by parent div
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground truncate">{p.productName}</span>
                        {p.manufacturer && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building2 className="w-3 h-3 inline" /> {p.manufacturer}
                          </span>
                        )}
                        {p.hsnSacCode && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                            HSN: {p.hsnSacCode}
                          </Badge>
                        )}
                      </div>

                      {/* Details row: Composition, Location, MRP, Stock */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1 flex-wrap">
                        {p.composition && (
                          <span className="flex items-center gap-1">
                            <Layers className="w-3 h-3 text-primary/70" />
                            <span className="truncate max-w-[150px]">Comp: {p.composition}</span>
                          </span>
                        )}
                        {p.rackLocation && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-amber-500/80" />
                            <span className="truncate max-w-[120px]">Loc: {p.rackLocation}</span>
                          </span>
                        )}
                        <span className="font-medium text-foreground">
                          MRP: ₹{p.mrp ?? p.unitPrice ?? 0}
                        </span>
                        <span>
                          Stock:{' '}
                          <span className={`font-semibold ${ (p.stockQuantity ?? 0) <= 5 ? 'text-destructive' : 'text-foreground'}`}>
                            {p.stockQuantity ?? 0}
                          </span>
                        </span>
                      </div>

                      {existingLinkText && (
                        <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1">
                          <AlertCircle className="w-3 h-3" />
                          <span>{existingLinkText}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    {isChecked ? (
                      <Badge className="bg-primary text-primary-foreground text-xs gap-1">
                        <Check className="w-3 h-3" /> Selected
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Click to select
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between bg-muted/20">
          <div className="text-xs text-muted-foreground">
            {selectedIds.size} product{selectedIds.size === 1 ? '' : 's'} will be linked to <span className="font-semibold text-foreground">{targetName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSubmitting} className="min-w-[100px]">
              {isSubmitting ? 'Saving...' : 'Save Selection'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
