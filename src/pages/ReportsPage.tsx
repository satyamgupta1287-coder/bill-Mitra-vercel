import { useState } from 'react';
import { getReports } from 'zite-endpoints-sdk';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { Download, FileText } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

const COLORS = ['hsl(243, 75%, 59%)', 'hsl(160, 60%, 45%)', 'hsl(30, 80%, 55%)', 'hsl(280, 65%, 60%)', 'hsl(340, 75%, 55%)'];

export default function ReportsPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [salesData, setSalesData] = useState<any>(null);
  const [gstData, setGstData] = useState<any>(null);
  const [customerData, setCustomerData] = useState<any>(null);

  const loadReport = async (type: string) => {
    setLoading(true);
    try {
      const result = await getReports({ reportType: type, startDate: startDate || undefined, endDate: endDate || undefined });
      if (type === 'sales') setSalesData(result.data);
      if (type === 'gst') setGstData(result.data);
      if (type === 'customer') setCustomerData(result.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const exportCsv = (data: any[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csv = [headers.join(','), ...data.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground">Business analytics and GST reports</p>
      </div>

      {/* Date Filters */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-4">
          <div><Label>From</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Tabs defaultValue="sales" onValueChange={v => loadReport(v)}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="sales">Sales Report</TabsTrigger>
          <TabsTrigger value="gst">GST Report</TabsTrigger>
          <TabsTrigger value="customer">Customer Report</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-6 mt-6">
          {loading ? <Skeleton className="h-80 rounded-xl" /> : salesData ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Total Revenue</p><p className="text-2xl font-bold mt-1">{formatCurrency(salesData.totalRevenue)}</p></CardContent></Card>
                <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Total Tax</p><p className="text-2xl font-bold mt-1">{formatCurrency(salesData.totalTax)}</p></CardContent></Card>
                <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Invoices</p><p className="text-2xl font-bold mt-1">{salesData.count}</p></CardContent></Card>
              </div>
              {Object.keys(salesData.summary).length > 0 && (
                <Card>
                  <CardHeader className="flex-row items-center justify-between">
                    <CardTitle className="text-sm">Monthly Revenue</CardTitle>
                    <Button variant="outline" size="sm" onClick={() => exportCsv(
                      Object.entries(salesData.summary).map(([m, d]: any) => ({ month: m, revenue: d.revenue, invoices: d.count, tax: d.tax })),
                      'sales-report.csv'
                    )}><Download className="w-3 h-3 mr-1" />Export CSV</Button>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={Object.entries(salesData.summary).map(([m, d]: any) => ({ month: m, revenue: d.revenue, tax: d.tax }))}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Bar dataKey="revenue" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="tax" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </>
          ) : <Card><CardContent className="py-12 text-center text-muted-foreground">Click on &quot;Sales Report&quot; tab to load data</CardContent></Card>}
        </TabsContent>

        <TabsContent value="gst" className="space-y-6 mt-6">
          {loading ? <Skeleton className="h-80 rounded-xl" /> : gstData ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Total CGST</p><p className="text-2xl font-bold mt-1">{formatCurrency(gstData.totalCgst)}</p></CardContent></Card>
                <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Total SGST</p><p className="text-2xl font-bold mt-1">{formatCurrency(gstData.totalSgst)}</p></CardContent></Card>
                <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Total IGST</p><p className="text-2xl font-bold mt-1">{formatCurrency(gstData.totalIgst)}</p></CardContent></Card>
              </div>

              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="text-sm">GST Detail</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => exportCsv(gstData.records, 'gst-report.csv')}><Download className="w-3 h-3 mr-1" />Export CSV</Button>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left py-2">Invoice #</th><th className="text-left py-2">Date</th><th className="text-left py-2">Type</th><th className="text-right py-2">Subtotal</th><th className="text-right py-2">CGST</th><th className="text-right py-2">SGST</th><th className="text-right py-2">IGST</th><th className="text-right py-2">Total</th>
                    </tr></thead>
                    <tbody>
                      {gstData.records.map((r: any, i: number) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-2 font-medium">{r.invoiceNumber}</td>
                          <td className="py-2 text-muted-foreground">{r.date}</td>
                          <td className="py-2 text-muted-foreground">{r.type}</td>
                          <td className="py-2 text-right">{formatCurrency(r.subtotal)}</td>
                          <td className="py-2 text-right">{formatCurrency(r.cgst)}</td>
                          <td className="py-2 text-right">{formatCurrency(r.sgst)}</td>
                          <td className="py-2 text-right">{formatCurrency(r.igst)}</td>
                          <td className="py-2 text-right font-semibold">{formatCurrency(r.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {(gstData.totalCgst > 0 || gstData.totalSgst > 0 || gstData.totalIgst > 0) && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">GST Distribution</CardTitle></CardHeader>
                  <CardContent className="flex justify-center">
                    <PieChart width={300} height={250}>
                      <Pie
                        data={[
                          { name: 'CGST', value: gstData.totalCgst },
                          { name: 'SGST', value: gstData.totalSgst },
                          { name: 'IGST', value: gstData.totalIgst },
                        ].filter(d => d.value > 0)}
                        cx={150} cy={120} innerRadius={60} outerRadius={90}
                        dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {[0, 1, 2].map(i => <Cell key={i} fill={COLORS[i]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    </PieChart>
                  </CardContent>
                </Card>
              )}
            </>
          ) : <Card><CardContent className="py-12 text-center text-muted-foreground">Click &quot;GST Report&quot; tab to load</CardContent></Card>}
        </TabsContent>

        <TabsContent value="customer" className="space-y-6 mt-6">
          {loading ? <Skeleton className="h-80 rounded-xl" /> : customerData ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-sm">Customer Revenue</CardTitle>
                <Button variant="outline" size="sm" onClick={() => exportCsv(customerData.customers, 'customer-report.csv')}><Download className="w-3 h-3 mr-1" />Export CSV</Button>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2">Customer</th><th className="text-right py-2">Invoices</th><th className="text-right py-2">Revenue</th><th className="text-right py-2">Outstanding</th>
                  </tr></thead>
                  <tbody>
                    {customerData.customers.map((c: any, i: number) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2.5 font-medium">{c.name}</td>
                        <td className="py-2.5 text-right">{c.count}</td>
                        <td className="py-2.5 text-right font-semibold">{formatCurrency(c.revenue)}</td>
                        <td className="py-2.5 text-right text-amber-600">{formatCurrency(c.outstanding)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {customerData.customers.length === 0 && <p className="text-center text-muted-foreground py-8">No customer data</p>}
              </CardContent>
            </Card>
          ) : <Card><CardContent className="py-12 text-center text-muted-foreground">Click &quot;Customer Report&quot; tab to load</CardContent></Card>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
