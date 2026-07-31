import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDashboard, GetDashboardOutputType } from 'zite-endpoints-sdk';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { FileText, Users, IndianRupee, AlertTriangle, TrendingUp, Plus } from 'lucide-react';

type DashData = GetDashboardOutputType;

export default function DashboardPage() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard({}).then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (!data) return null;

  const stats = [
    { label: 'Total Invoices', value: data.totalInvoices, icon: FileText, color: 'text-primary' },
    { label: 'Revenue Collected', value: formatCurrency(data.totalRevenue), icon: IndianRupee, color: 'text-emerald-500' },
    { label: 'Pending Amount', value: formatCurrency(data.totalPending), icon: TrendingUp, color: 'text-amber-500' },
    { label: 'Total Customers', value: data.totalCustomers, icon: Users, color: 'text-primary' },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of your business</p>
        </div>
        <Link to="/invoices/new">
          <Button><Plus className="w-4 h-4 mr-2" />New Invoice</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                  <p className="text-2xl font-bold mt-1">{s.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center ${s.color}`}>
                  <s.icon className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* GST Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'CGST Collected', value: data.totalCgst },
          { label: 'SGST Collected', value: data.totalSgst },
          { label: 'IGST Collected', value: data.totalIgst },
        ].map(g => (
          <Card key={g.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-2 h-8 rounded-full bg-primary" />
              <div>
                <p className="text-xs text-muted-foreground">{g.label}</p>
                <p className="text-lg font-bold">{formatCurrency(g.value)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Monthly Revenue</CardTitle></CardHeader>
          <CardContent>
            {data.monthlyRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="revenue" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
            )}
          </CardContent>
        </Card>

        {/* Recent Invoices */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm">Recent Invoices</CardTitle>
            <Link to="/invoices"><Button variant="ghost" size="sm">View All</Button></Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.recentInvoices.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No invoices yet</p>}
              {data.recentInvoices.slice(0, 5).map((inv: any) => (
                <Link key={inv.id} to={`/invoices/${inv.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(inv.invoiceDate)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(inv.totalAmount)}</p>
                    <StatusBadge status={inv.status} />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overdue alert */}
      {data.totalOverdue > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <p className="text-sm font-medium">You have {formatCurrency(data.totalOverdue)} in overdue invoices.</p>
            <Link to="/invoices?status=Overdue" className="ml-auto">
              <Button variant="outline" size="sm">View Overdue</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Paid: 'bg-emerald-500/10 text-emerald-600',
    Pending: 'bg-amber-500/10 text-amber-600',
    Draft: 'bg-muted text-muted-foreground',
    Cancelled: 'bg-destructive/10 text-destructive',
    Overdue: 'bg-destructive/10 text-destructive',
    'Partially Paid': 'bg-blue-500/10 text-blue-600',
  };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors[status] || 'bg-muted text-muted-foreground'}`}>{status}</span>;
}

function DashboardSkeleton() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}
