import { useEffect, useState } from 'react';
import { getCompany, saveCompany } from 'zite-endpoints-sdk';
import { uploadFile } from 'zite-file-upload-sdk';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Building2, Upload, FileText, ChevronRight } from 'lucide-react';
import { INDIAN_STATES } from '@/lib/utils';
import { Link } from 'react-router-dom';

export default function SettingsPage() {
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    getCompany({}).then(r => {
      if (r.company) {
        setCompany(r.company);
        if (r.company.logo?.[0]?.url) setLogoUrl(r.company.logo[0].url);
      }
      setLoading(false);
    });
  }, []);

  const handleLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { fileUrl } = await uploadFile({ data: file, filename: file.name });
      setLogoUrl(fileUrl);
      toast.success('Logo uploaded');
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: any = {};
    fd.forEach((v, k) => { if (v && k !== 'logoFile') data[k] = v; });
    if (company?.id) data.companyId = company.id;
    if (logoUrl) data.logoUrl = logoUrl;

    setSaving(true);
    try {
      const result = await saveCompany(data);
      setCompany(result.company);
      toast.success('Company settings saved');
    } catch (e: any) { toast.error('Failed to save: ' + (e.message || 'Unknown error')); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-8"><Skeleton className="h-96 rounded-xl" /></div>;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Company Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your company profile and invoice settings</p>
      </div>

      {/* Invoice Templates Link */}
      <Link to="/settings/templates" className="block">
        <Card className="hover:border-primary/40 transition-colors cursor-pointer">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold">Invoice Templates</h3>
              <p className="text-xs text-muted-foreground">Choose your invoice design and customize display options</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>

      {/* Invoice Templates Link */}
      <Link to="/settings/templates">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold">Invoice Templates</h3>
              <p className="text-xs text-muted-foreground">Choose your default invoice design and customize options</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Logo */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Company Logo</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-4">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-20 h-20 object-contain rounded-lg border" />
            ) : (
              <div className="w-20 h-20 rounded-lg border-2 border-dashed flex items-center justify-center">
                <Building2 className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
            <div>
              <Label htmlFor="logoFile" className="cursor-pointer">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-accent transition-colors">
                  <Upload className="w-4 h-4" />{uploading ? 'Uploading...' : 'Upload Logo'}
                </div>
              </Label>
              <input id="logoFile" name="logoFile" type="file" accept="image/*" className="hidden" onChange={handleLogo} />
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 5MB</p>
            </div>
          </CardContent>
        </Card>

        {/* Company Details */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Company Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><Label>Company Name *</Label><Input name="companyName" required defaultValue={company?.companyName} /></div>
            <div><Label>GSTIN</Label><Input name="gstin" placeholder="22AAAAA0000A1Z5" defaultValue={company?.gstin} /></div>
            <div><Label>PAN</Label><Input name="pan" defaultValue={company?.pan} /></div>
            <div><Label>DL Number 1</Label><Input name="dlNumber1" defaultValue={company?.dlNumber1} placeholder="Drug License No." /></div>
            <div><Label>DL Number 2</Label><Input name="dlNumber2" defaultValue={company?.dlNumber2} /></div>
            <div>
              <Label>State</Label>
              <Select name="state" defaultValue={company?.state}>
                <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                <SelectContent>{INDIAN_STATES.map(s => <SelectItem key={s.code} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>State Code</Label><Input name="stateCode" defaultValue={company?.stateCode} /></div>
            <div className="md:col-span-2"><Label>Address</Label><Textarea name="address" rows={2} defaultValue={company?.address} /></div>
            <div><Label>City</Label><Input name="city" defaultValue={company?.city} /></div>
            <div><Label>Pincode</Label><Input name="pincode" defaultValue={company?.pincode} /></div>
            <div><Label>Phone</Label><Input name="phone" defaultValue={company?.phone} /></div>
            <div><Label>Email</Label><Input name="companyEmail" type="email" defaultValue={company?.companyEmail} /></div>
            <div><Label>Website</Label><Input name="website" defaultValue={company?.website} /></div>
          </CardContent>
        </Card>

        {/* Bank Details */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Bank Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Bank Name</Label><Input name="bankName" defaultValue={company?.bankName} /></div>
            <div><Label>Account Number</Label><Input name="accountNumber" defaultValue={company?.accountNumber} /></div>
            <div><Label>IFSC Code</Label><Input name="ifscCode" defaultValue={company?.ifscCode} /></div>
            <div><Label>UPI ID</Label><Input name="upiId" placeholder="yourcompany@upi" defaultValue={company?.upiId} /></div>
          </CardContent>
        </Card>

        {/* Invoice Settings */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Invoice Settings</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Invoice Prefix</Label><Input name="invoicePrefix" defaultValue={company?.invoicePrefix || 'INV'} /></div>
            <div><Label>Terms & Conditions</Label><Textarea name="termsAndConditions" rows={4} defaultValue={company?.termsAndConditions} /></div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</Button>
        </div>
      </form>
    </div>
  );
}
