import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from 'zite-auth-sdk';
import { useTheme } from './ThemeProvider';
import {
  LayoutDashboard, Users, Package, FileText, Settings, BarChart3,
  Sun, Moon, LogOut, Menu, X, ChevronRight, Receipt, ShoppingCart, Truck, KeyRound,
  Keyboard, CornerDownLeft, ArrowUpDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/invoices', icon: FileText, label: 'Invoices' },
  { to: '/purchases', icon: ShoppingCart, label: 'Purchases' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/suppliers', icon: Truck, label: 'Suppliers' },
  { to: '/products', icon: Package, label: 'Products' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/licenses', icon: KeyRound, label: 'Licenses', adminOnly: true },
  { to: '/settings', icon: Settings, label: 'Settings' },
] as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in input or textarea, unless it's a modifier key combo
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);

      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        navigate('/invoices/new');
      } else if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        navigate('/purchases/new');
      } else if (e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        navigate('/');
      } else if (e.altKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        navigate('/invoices');
      } else if (e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowShortcutsModal(prev => !prev);
      } else if (e.key === 'F1') {
        e.preventDefault();
        setShowShortcutsModal(prev => !prev);
      } else if (e.key === 'F2') {
        e.preventDefault();
        navigate('/purchases');
      } else if (!isInput && e.key === '?') {
        e.preventDefault();
        setShowShortcutsModal(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed z-50 lg:static inset-y-0 left-0 w-64 bg-card border-r border-border flex flex-col transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Receipt className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground">GST Invoice</h1>
            <p className="text-[10px] text-muted-foreground">Manager</p>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.filter(item => !('adminOnly' in item && item.adminOnly) || user?.role === 'Admin').map(item => {
            const active = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
                {active && <ChevronRight className="w-3 h-3 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border space-y-1.5">
          <button
            onClick={() => setShowShortcutsModal(true)}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
          >
            <Keyboard className="w-4 h-4" />
            <span>Shortcuts Guide</span>
            <span className="ml-auto text-[10px] bg-background px-1.5 py-0.5 rounded border border-border font-mono">F1</span>
          </button>

          <button onClick={toggle} className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors">
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          </button>
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
              {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user?.firstName || user?.email}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user?.role || 'User'}</p>
            </div>
            <button onClick={() => logout()} className="text-muted-foreground hover:text-destructive">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-border flex items-center px-4 justify-between lg:justify-end">
          <div className="flex items-center lg:hidden">
            <button onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="ml-3 text-sm font-semibold">GST Invoice Manager</h1>
          </div>
          <button
            onClick={() => setShowShortcutsModal(true)}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-muted/30 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Keyboard className="w-3.5 h-3.5 text-primary" />
            <span>Keyboard Shortcuts</span>
            <kbd className="px-1.5 py-0.5 text-[10px] bg-background border border-border rounded font-mono font-bold">F1</kbd>
          </button>
        </header>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Global Keyboard Shortcuts Modal */}
      {showShortcutsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Keyboard className="w-5 h-5" />
                <h2 className="font-bold text-base">Keyboard Shortcuts Guide (कीबोर्ड शॉर्टकट्स)</h2>
              </div>
              <button onClick={() => setShowShortcutsModal(false)} className="text-primary-foreground/80 hover:text-primary-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
              <div>
                <h3 className="font-bold text-sm text-primary mb-2 flex items-center gap-1.5">
                  <CornerDownLeft className="w-4 h-4" /> Billing & Table Navigation (बिलिंग में कीबोर्ड उपयोग)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <ShortcutItem keys={['CTRL', 'N']} label="Add new product row (नया प्रोडक्ट रो जोड़ें)" />
                  <ShortcutItem keys={['CTRL', 'T']} label="Delete focused product row (प्रोडक्ट रो डिलीट करें)" />
                  <ShortcutItem keys={['ENTER']} label="Next cell / Add new row in bill" />
                  <ShortcutItem keys={['↑', '↓', '←', '→']} label="Navigate table rows & cells (ऊपर/नीचे/दाएं/बाएं सेल में जाएं)" />
                  <ShortcutItem keys={['ENTER']} label="Select highlighted item / batch" />
                  <ShortcutItem keys={['ESC']} label="Close dropdown / batch popup" />
                  <ShortcutItem keys={['CTRL', 'S']} label="Save Purchase or Invoice Bill" />
                  <ShortcutItem keys={['TAB']} label="Move to next field" />
                </div>
              </div>

              <div className="border-t border-border pt-3">
                <h3 className="font-bold text-sm text-primary mb-2 flex items-center gap-1.5">
                  <ArrowUpDown className="w-4 h-4" /> Quick Navigation (त्वरित शॉर्टकट्स)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <ShortcutItem keys={['F2']} label="Purchases History (पर्चेस हिस्ट्री देखें)" />
                  <ShortcutItem keys={['ALT', 'N']} label="New Invoice (नया सेल्स बिल)" />
                  <ShortcutItem keys={['ALT', 'P']} label="New Purchase Entry (नया पर्चेस बिल)" />
                  <ShortcutItem keys={['ALT', 'D']} label="Dashboard (डैशबोर्ड)" />
                  <ShortcutItem keys={['ALT', 'I']} label="Invoices List (इनवॉइस सूची)" />
                  <ShortcutItem keys={['F1']} label="Toggle Shortcuts Guide (शॉर्टकट गाइड)" />
                </div>
              </div>
            </div>

            <div className="bg-muted/50 px-4 py-2 text-[11px] text-muted-foreground flex justify-between items-center border-t border-border">
              <span>Press <kbd className="px-1.5 py-0.5 bg-background border rounded font-mono font-bold">ESC</kbd> to close</span>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowShortcutsModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShortcutItem({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/50">
      <span className="text-foreground font-medium text-[11px]">{label}</span>
      <div className="flex items-center gap-1 shrink-0">
        {keys.map((k, i) => (
          <kbd key={i} className="px-1.5 py-0.5 text-[10px] font-mono font-extrabold bg-background border border-border rounded shadow-xs text-foreground">
            {k}
          </kbd>
        ))}
      </div>
    </div>
  );
}
