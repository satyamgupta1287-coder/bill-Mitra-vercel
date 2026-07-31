import { useEffect, useState } from 'react';
import { getUserSettings, saveUserSettings, GetUserSettingsOutputType } from 'zite-endpoints-sdk';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Check, Eye, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

type Settings = GetUserSettingsOutputType['settings'];

type TemplateInfo = { id: string; name: string; desc: string; icon: string };
type TemplateGroup = { label: string; templates: TemplateInfo[] };

const TEMPLATE_GROUPS: TemplateGroup[] = [
  {
    label: 'General',
    templates: [
      { id: 'General GST', name: 'General GST Invoice', desc: 'Standard GST bill for any business type', icon: '📋' },
      { id: 'Indian Retail Bill', name: 'Indian Retail Bill', desc: 'Compact counter sale format with large total', icon: '🇮🇳' },
      { id: 'Proforma Invoice', name: 'Proforma Invoice', desc: 'Quotation / estimate with "PROFORMA" watermark', icon: '📝' },
      { id: 'Thermal Receipt', name: 'Thermal Receipt', desc: 'Narrow 80mm format for thermal printers', icon: '🧾' },
    ],
  },
  {
    label: 'Industry-Specific',
    templates: [
      { id: 'Electronics / Mobile', name: 'Electronics / Mobile Shop', desc: 'IMEI, Serial No., Warranty columns', icon: '📱' },
      { id: 'Restaurant / Food', name: 'Restaurant / Food Bill', desc: 'Service Charge + FSSAI No. in header', icon: '🍽️' },
      { id: 'Grocery / Kirana', name: 'Grocery / Kirana Store', desc: 'Unit (kg/ltr/pcs), MRP, Rate columns', icon: '🛒' },
      { id: 'Furniture / Hardware', name: 'Furniture / Hardware', desc: 'Material description, Size/Dimensions', icon: '🪑' },
      { id: 'Services Invoice', name: 'Services Invoice', desc: 'SAC Code, Hours/Qty for consultants', icon: '💼' },
    ],
  },
  {
    label: 'Medical / Pharma',
    templates: [
      { id: 'Classic GST', name: 'Classic GST Invoice', desc: 'Full pharma layout with Batch, Expiry, MRP, DL No.', icon: '📄' },
      { id: 'Modern GST', name: 'Modern GST Invoice', desc: 'Clean accent color header with minimal layout', icon: '✨' },
      { id: 'Retail Invoice', name: 'Retail Invoice', desc: 'Simplified pharma retail counter sale', icon: '💊' },
      { id: 'Wholesale Invoice', name: 'Wholesale Invoice', desc: 'Detailed pharma wholesale with same clean UI', icon: '📦' },
      { id: 'Delivery Challan', name: 'Delivery Challan', desc: 'Pharma challan format with no customer details', icon: '🚚' },
      { id: 'Tax Invoice Premium', name: 'Tax Invoice Premium', desc: 'Professional watermark with dual signature', icon: '💎' },
    ],
  },
];

const ALL_TEMPLATES = TEMPLATE_GROUPS.flatMap(g => g.templates);

export default function InvoiceTemplatesPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null);
  const [localSettings, setLocalSettings] = useState<Settings | null>(null);

  useEffect(() => {
    getUserSettings({}).then(r => {
      setSettings(r.settings);
      setLocalSettings(r.settings);
    }).finally(() => setLoading(false));
  }, []);

  const selectTemplate = async (templateId: string) => {
    if (!settings) return;
    setSaving(true);
    try {
      await saveUserSettings({ settingsId: settings.id, selectedTemplate: templateId });
      setSettings(s => s ? { ...s, selectedTemplate: templateId } : s);
      setLocalSettings(s => s ? { ...s, selectedTemplate: templateId } : s);
      toast.success(`Template changed to ${ALL_TEMPLATES.find(t => t.id === templateId)?.name || templateId}`);
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const savePreferences = async () => {
    if (!settings || !localSettings) return;
    setSaving(true);
    try {
      await saveUserSettings({
        settingsId: settings.id,
        showLogo: localSettings.showLogo,
        showBankDetails: localSettings.showBankDetails,
        showSignature: localSettings.showSignature,
        showQrCode: localSettings.showQrCode,
        customFooterText: localSettings.customFooterText,
      });
      setSettings(localSettings);
      toast.success('Preferences saved');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  if (loading) return <TemplateSkeleton />;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Link to="/settings">
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" />Settings</Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Invoice Templates</h1>
          <p className="text-sm text-muted-foreground">Choose your default invoice design — works for all business types</p>
        </div>
      </div>

      {TEMPLATE_GROUPS.map(group => (
        <TemplateGroupSection
          key={group.label}
          group={group}
          selectedId={settings?.selectedTemplate || 'Classic GST'}
          saving={saving}
          onSelect={selectTemplate}
          onPreview={setPreviewTemplate}
        />
      ))}

      {/* Customization Options */}
      {localSettings && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <h3 className="font-semibold text-sm">Customization Options</h3>
            <p className="text-xs text-muted-foreground">These settings apply to all templates</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ToggleRow label="Show Company Logo" checked={localSettings.showLogo} onChange={v => setLocalSettings(s => s ? { ...s, showLogo: v } : s)} />
              <ToggleRow label="Show Bank Details" checked={localSettings.showBankDetails} onChange={v => setLocalSettings(s => s ? { ...s, showBankDetails: v } : s)} />
              <ToggleRow label="Show Signature Area" checked={localSettings.showSignature} onChange={v => setLocalSettings(s => s ? { ...s, showSignature: v } : s)} />
              <ToggleRow label="Show QR Code" checked={localSettings.showQrCode} onChange={v => setLocalSettings(s => s ? { ...s, showQrCode: v } : s)} />
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">Custom Footer Text</label>
                <Input
                  className="mt-1"
                  placeholder="e.g. Thank you for your business!"
                  value={localSettings.customFooterText}
                  onChange={e => setLocalSettings(s => s ? { ...s, customFooterText: e.target.value } : s)}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={savePreferences} disabled={saving}>
                {saving ? 'Saving...' : 'Save Preferences'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Modal */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {ALL_TEMPLATES.find(t => t.id === previewTemplate)?.icon}{' '}
              {ALL_TEMPLATES.find(t => t.id === previewTemplate)?.name} — Preview
            </DialogTitle>
          </DialogHeader>
          {previewTemplate && <TemplateFullPreview templateId={previewTemplate} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateGroupSection({ group, selectedId, saving, onSelect, onPreview }: {
  group: TemplateGroup;
  selectedId: string;
  saving: boolean;
  onSelect: (id: string) => void;
  onPreview: (id: string) => void;
}) {
  return (
    <div>
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{group.label}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {group.templates.map(t => {
          const selected = selectedId === t.id;
          return (
            <Card key={t.id} className={`overflow-hidden transition-all ${selected ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}>
              <CardContent className="p-0">
                <TemplateThumb templateId={t.id} icon={t.icon} />
                <div className="p-4">
                  <h3 className="font-semibold text-sm">{t.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.desc}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => onPreview(t.id)}>
                      <Eye className="w-3 h-3 mr-1" />Preview
                    </Button>
                    {selected ? (
                      <Button size="sm" className="text-xs h-8" disabled>
                        <Check className="w-3 h-3 mr-1" />Selected
                      </Button>
                    ) : (
                      <Button variant="secondary" size="sm" className="text-xs h-8" onClick={() => onSelect(t.id)} disabled={saving}>
                        Use Template
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function TemplateThumb({ templateId, icon }: { templateId: string; icon: string }) {
  return (
    <div className="h-32 bg-muted/40 flex items-center justify-center relative overflow-hidden">
      <div className="text-4xl">{icon}</div>
      <div className="absolute bottom-2 left-2 right-2 flex gap-1">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-1 bg-foreground/10 rounded flex-1" />
        ))}
      </div>
    </div>
  );
}

function TemplateFullPreview({ templateId }: { templateId: string }) {
  const SAMPLE_DATA: Record<string, { company: string; items: { name: string; hsn: string; qty: number; rate: number; gst: number; extra?: string }[] }> = {
    'General GST': { company: 'ABC Trading Co.', items: [
      { name: 'Office Chair (Ergonomic)', hsn: '94013000', qty: 5, rate: 8500, gst: 18 },
      { name: 'Standing Desk 120cm', hsn: '94033000', qty: 3, rate: 15200, gst: 18 },
      { name: 'LED Monitor 24"', hsn: '85285900', qty: 10, rate: 12000, gst: 18 },
    ]},
    'Indian Retail Bill': { company: 'Ram General Store', items: [
      { name: 'Basmati Rice 5kg', hsn: '10063020', qty: 2, rate: 450, gst: 5 },
      { name: 'Refined Oil 1L', hsn: '15079010', qty: 3, rate: 180, gst: 5 },
      { name: 'Sugar 1kg', hsn: '17019910', qty: 5, rate: 45, gst: 5 },
    ]},
    'Electronics / Mobile': { company: 'Mobile Galaxy', items: [
      { name: 'Samsung Galaxy S24 Ultra', hsn: '85171200', qty: 1, rate: 129999, gst: 18, extra: 'IMEI: 352456789012345' },
      { name: 'iPhone 15 Pro Max 256GB', hsn: '85171200', qty: 1, rate: 159900, gst: 18, extra: 'IMEI: 356789012345678' },
      { name: 'OnePlus Buds Pro 2', hsn: '85183000', qty: 2, rate: 9999, gst: 18 },
    ]},
    'Restaurant / Food': { company: 'Spice Garden Restaurant', items: [
      { name: 'Butter Chicken', hsn: '21069099', qty: 2, rate: 380, gst: 5 },
      { name: 'Garlic Naan (4 pcs)', hsn: '19059040', qty: 3, rate: 120, gst: 5 },
      { name: 'Paneer Tikka', hsn: '21069099', qty: 1, rate: 320, gst: 5 },
      { name: 'Cold Drinks', hsn: '22021010', qty: 4, rate: 60, gst: 12 },
    ]},
    'Grocery / Kirana': { company: 'Sharma Kirana Store', items: [
      { name: 'Toor Dal 1kg', hsn: '07132000', qty: 3, rate: 160, gst: 5 },
      { name: 'Wheat Flour 10kg', hsn: '11010000', qty: 1, rate: 380, gst: 0 },
      { name: 'Ghee 1L', hsn: '04059020', qty: 2, rate: 550, gst: 12 },
      { name: 'Tea 250g', hsn: '09024010', qty: 4, rate: 180, gst: 5 },
    ]},
    'Furniture / Hardware': { company: 'Royal Furniture House', items: [
      { name: 'Sheesham Dining Table', hsn: '94036000', qty: 1, rate: 45000, gst: 18, extra: '6-seater, 180x90cm' },
      { name: 'Dining Chair Set (6)', hsn: '94013000', qty: 1, rate: 24000, gst: 18, extra: 'Cushioned, Walnut finish' },
      { name: 'TV Unit Wall Mount', hsn: '94036000', qty: 1, rate: 18500, gst: 18, extra: '150x40x50 cm' },
    ]},
    'Services Invoice': { company: 'TechSoft Solutions Pvt. Ltd.', items: [
      { name: 'Website Development', hsn: '998314', qty: 1, rate: 85000, gst: 18 },
      { name: 'UI/UX Design (per page)', hsn: '998314', qty: 12, rate: 5000, gst: 18 },
      { name: 'SEO Setup & Optimization', hsn: '998366', qty: 1, rate: 25000, gst: 18 },
    ]},
    'Proforma Invoice': { company: 'BuildMart Supplies', items: [
      { name: 'Portland Cement 50kg', hsn: '25232900', qty: 100, rate: 380, gst: 28 },
      { name: 'TMT Steel Bar 12mm', hsn: '72142000', qty: 50, rate: 650, gst: 18 },
      { name: 'Red Bricks (per 1000)', hsn: '69010010', qty: 5, rate: 6500, gst: 5 },
    ]},
  };

  // Fallback for pharma templates
  const defaultData = { company: 'ABC Pharma Pvt. Ltd.', items: [
    { name: 'Paracetamol 500mg', hsn: '30049099', qty: 100, rate: 25, gst: 12 },
    { name: 'Amoxicillin 250mg', hsn: '30049029', qty: 50, rate: 68.5, gst: 12 },
    { name: 'Vitamin D3 Capsules', hsn: '30049099', qty: 30, rate: 180, gst: 18 },
  ]};

  const data = SAMPLE_DATA[templateId] || defaultData;
  const subtotal = data.items.reduce((s, i) => s + i.qty * i.rate, 0);
  const cgst = data.items.reduce((s, i) => s + (i.qty * i.rate * i.gst / 200), 0);
  const total = subtotal + cgst * 2;

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <div className="p-3 text-center bg-muted/50 border-b border-border">
        <p className="text-xs text-muted-foreground">Sample preview with <strong>{data.company}</strong> data</p>
      </div>
      <div className="p-4 md:p-6 text-xs space-y-3">
        <div className="font-bold text-base">{data.company}</div>
        <div className="text-muted-foreground text-[11px]">123 Market Road, New Delhi | GSTIN: 07AAAAA0000A1Z5 | Ph: 011-23456789</div>

        <div className="text-center font-semibold text-sm py-1 border-y border-border">
          {templateId === 'Thermal Receipt' ? 'RECEIPT' : templateId === 'Proforma Invoice' ? 'PROFORMA INVOICE' : templateId.includes('Restaurant') ? 'FOOD BILL' : templateId.includes('Services') ? 'SERVICE INVOICE' : 'TAX INVOICE'}
        </div>

        <div className="flex justify-between text-[11px]">
          <div><span className="text-muted-foreground">Invoice:</span> <strong>INV-2026-001</strong></div>
          <div><span className="text-muted-foreground">Date:</span> <strong>07/06/2026</strong></div>
        </div>

        <div className="bg-muted/50 rounded-md p-2 text-[11px]">
          <div className="font-semibold">Customer Name</div>
          <div className="text-muted-foreground">456 Market Road, Lucknow, UP | GSTIN: 09BBBBB0000B1Z6</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-1.5 font-semibold">#</th>
                <th className="text-left p-1.5 font-semibold">
                  {templateId.includes('Services') ? 'Service' : 'Product'}
                </th>
                {templateId === 'Electronics / Mobile' && <th className="p-1.5 font-semibold">IMEI</th>}
                {templateId === 'Grocery / Kirana' && <th className="p-1.5 font-semibold">Unit</th>}
                {templateId === 'Furniture / Hardware' && <th className="p-1.5 font-semibold">Size</th>}
                <th className="text-right p-1.5 font-semibold">Qty</th>
                <th className="text-right p-1.5 font-semibold">Rate</th>
                {templateId !== 'Thermal Receipt' && templateId !== 'Indian Retail Bill' && <th className="text-right p-1.5 font-semibold">GST%</th>}
                <th className="text-right p-1.5 font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="p-1.5">{i + 1}</td>
                  <td className="p-1.5 font-medium">{item.name}</td>
                  {templateId === 'Electronics / Mobile' && <td className="p-1.5 text-[10px] font-mono">{item.extra || '-'}</td>}
                  {templateId === 'Grocery / Kirana' && <td className="p-1.5">pcs</td>}
                  {templateId === 'Furniture / Hardware' && <td className="p-1.5 text-[10px]">{item.extra || '-'}</td>}
                  <td className="p-1.5 text-right">{item.qty}</td>
                  <td className="p-1.5 text-right">₹{item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  {templateId !== 'Thermal Receipt' && templateId !== 'Indian Retail Bill' && <td className="p-1.5 text-right">{item.gst}%</td>}
                  <td className="p-1.5 text-right font-semibold">₹{(item.qty * item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <div className="w-52 space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
            {templateId === 'Restaurant / Food' && <div className="flex justify-between"><span className="text-muted-foreground">Svc Charge</span><span>₹500.00</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">CGST</span><span>₹{cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">SGST</span><span>₹{cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between font-bold border-t border-border pt-1"><span>Grand Total</span><span>₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
          </div>
        </div>

        <div className="border-t border-border pt-2 text-[10px] text-muted-foreground">
          Bank: State Bank of India | A/C: 1234567890 | IFSC: SBIN0001234
        </div>
        {templateId === 'Proforma Invoice' && (
          <div className="bg-accent/20 border border-accent rounded p-2 text-[10px]">
            <strong>⚠ Note:</strong> This is a proforma invoice / quotation. Prices subject to change.
          </div>
        )}
        <div className="text-right text-[10px] pt-4">
          <div className="border-t border-border inline-block pt-1 px-4">Authorised Signatory</div>
        </div>
      </div>
    </div>
  );
}

function TemplateSkeleton() {
  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-32" />
      <div className="grid grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-56 rounded-xl" />)}
      </div>
      <Skeleton className="h-4 w-32" />
      <div className="grid grid-cols-4 gap-4">
        {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-56 rounded-xl" />)}
      </div>
    </div>
  );
}
