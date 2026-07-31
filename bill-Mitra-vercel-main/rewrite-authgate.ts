import fs from 'fs';

const content = fs.readFileSync('src/App.tsx', 'utf8');

const targetContentStart = `function AuthGate({ children }: { children: React.ReactNode }) {`;
const targetContentEnd = `  return <>{children}</>;
}`;

const startIndex = content.indexOf(targetContentStart);
const endIndex = content.indexOf(targetContentEnd) + targetContentEnd.length;

if (startIndex === -1 || endIndex === -1) {
  console.error("Could not find AuthGate function");
  process.exit(1);
}

const replacement = `function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading, loginWithRedirect, loginWithEmail, signUpWithEmail } = useAuth() as any;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-primary mx-auto flex items-center justify-center animate-pulse">
            <svg className="w-6 h-6 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /></svg>
          </div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setAuthError('Please enter both email and password.');
      return;
    }
    setIsSubmitting(true);
    setAuthError('');
    try {
      if (isLoginMode) {
        await loginWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Authentication failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute top-[60%] -right-[10%] w-[60%] h-[60%] rounded-full bg-primary/5 blur-3xl" />
        </div>
        
        <div className="w-full max-w-md p-8 relative z-10 bg-card rounded-2xl shadow-xl border border-border flex flex-col items-center mx-4">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-6 shadow-md">
            <svg className="w-8 h-8 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
            </svg>
          </div>
          
          <h1 className="text-3xl font-bold mb-2 text-foreground">Welcome to Bill Mitra</h1>
          <p className="text-muted-foreground mb-8 text-center text-sm">
            Sign in securely to manage your invoices, track purchases, and organize your business operations.
          </p>

          <form onSubmit={handleEmailAuth} className="w-full space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                placeholder="••••••••"
                required
              />
            </div>
            
            {authError && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                {authError}
              </div>
            )}
            
            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary text-primary-foreground px-6 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-all disabled:opacity-70"
            >
              {isSubmitting ? 'Please wait...' : (isLoginMode ? 'Sign In with Email' : 'Create Account')}
            </button>
            
            <div className="text-center text-sm">
              <button 
                type="button" 
                onClick={() => { setIsLoginMode(!isLoginMode); setAuthError(''); }}
                className="text-primary hover:underline"
              >
                {isLoginMode ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
              </button>
            </div>
          </form>

          <div className="w-full relative flex items-center justify-center my-4">
            <div className="absolute w-full border-t border-border"></div>
            <span className="relative bg-card px-4 text-xs text-muted-foreground uppercase tracking-wider font-medium">Or</span>
          </div>
          
          <button 
            onClick={() => loginWithRedirect()}
            className="w-full relative flex items-center justify-center gap-3 bg-secondary text-secondary-foreground px-6 py-3 rounded-xl font-medium hover:bg-secondary/80 transition-all active:scale-[0.98] border border-border"
          >
            <svg className="w-5 h-5 bg-white rounded-full p-0.5 group-hover:scale-110 transition-transform text-primary" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Sign In with Google
          </button>
          
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground w-full">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /></svg>
            <span>Secure authentication powered by Firebase</span>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}`;

const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);
fs.writeFileSync('src/App.tsx', newContent);
