'use client';

import { Sun, Moon, Menu, LogOut, User } from 'lucide-react';
import { useTheme } from '../providers/theme-provider';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Toolbar() {
  const { theme, setTheme } = useTheme();
  const { data: session, status } = useSession();
  const router = useRouter();

  const handleProtectedNavigation = (href: string) => {
    if (!session && href !== '/') {
      // If not logged in and trying to access protected route, redirect to login
      router.push(`/auth/login?callbackUrl=${encodeURIComponent(href)}`);
    } else {
      router.push(href);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex h-24 items-center justify-between">
          {/* Left side: Menu and Logo */}
          <div className="flex items-center" style={{ gap: '1rem' }}>
            {/* Navigation Menu */}
            <Sheet>
              <SheetTrigger asChild>
                <button className="p-2 rounded-lg hover:bg-accent transition-colors">
                  <Menu className="h-6 w-6" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] sm:w-[400px] border-r" style={{ top: 0, backgroundColor: 'var(--sidebar)', transition: 'none' }}>
                <SheetHeader className="flex items-center">
                  <SheetTitle className="flex justify-center">
                    <div style={{ width: '150px', height: '150px', position: 'relative' }}>
                      <Image
                        src="/prebid-logo.png"
                        alt="Prebid Logo"
                        fill
                        style={{ objectFit: 'contain' }}
                      />
                    </div>
                  </SheetTitle>
                </SheetHeader>
                <nav className="mt-8" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <button
                    onClick={() => handleProtectedNavigation('/')}
                    className="w-full flex items-center justify-center py-3 text-muted-foreground hover:text-foreground transition-colors"
                    style={{ backgroundColor: 'transparent', border: 'none' }}
                  >
                    <span style={{ fontSize: '20px', fontWeight: 500 }}>Dashboard</span>
                  </button>
                  <button
                    onClick={() => handleProtectedNavigation('/contributors')}
                    className="w-full flex items-center justify-center py-3 text-muted-foreground hover:text-foreground transition-colors"
                    style={{ backgroundColor: 'transparent', border: 'none' }}
                  >
                    <span style={{ fontSize: '20px', fontWeight: 500 }}>Contributors</span>
                  </button>
                  <button
                    onClick={() => handleProtectedNavigation('/companies')}
                    className="w-full flex items-center justify-center py-3 text-muted-foreground hover:text-foreground transition-colors"
                    style={{ backgroundColor: 'transparent', border: 'none' }}
                  >
                    <span style={{ fontSize: '20px', fontWeight: 500 }}>Companies</span>
                  </button>
                  
                  {/* Repos Section */}
                  <div className="w-full flex items-center justify-center py-2">
                    <span style={{ fontSize: '20px', fontWeight: 600, color: 'var(--foreground)' }}>Repos</span>
                  </div>
                  <button
                    onClick={() => handleProtectedNavigation('/repos/prebidjs')}
                    className="w-full flex items-center justify-center py-2 text-muted-foreground hover:text-foreground transition-colors"
                    style={{ backgroundColor: 'transparent', border: 'none' }}
                  >
                    <span style={{ fontSize: '18px', fontWeight: 400 }}>Prebid.js</span>
                  </button>
                  <button
                    onClick={() => handleProtectedNavigation('/repos/prebidserver')}
                    className="w-full flex items-center justify-center py-2 text-muted-foreground hover:text-foreground transition-colors"
                    style={{ backgroundColor: 'transparent', border: 'none' }}
                  >
                    <span style={{ fontSize: '18px', fontWeight: 400 }}>Prebid Server (Go)</span>
                  </button>
                  <button
                    onClick={() => handleProtectedNavigation('/repos/prebidserverjava')}
                    className="w-full flex items-center justify-center py-2 text-muted-foreground hover:text-foreground transition-colors"
                    style={{ backgroundColor: 'transparent', border: 'none' }}
                  >
                    <span style={{ fontSize: '18px', fontWeight: 400 }}>Prebid Server (Java)</span>
                  </button>
                  <button
                    onClick={() => handleProtectedNavigation('/repos/prebidmobileios')}
                    className="w-full flex items-center justify-center py-2 text-muted-foreground hover:text-foreground transition-colors"
                    style={{ backgroundColor: 'transparent', border: 'none' }}
                  >
                    <span style={{ fontSize: '18px', fontWeight: 400 }}>Prebid Mobile (iOS)</span>
                  </button>
                  <button
                    onClick={() => handleProtectedNavigation('/repos/prebidmobileandroid')}
                    className="w-full flex items-center justify-center py-2 text-muted-foreground hover:text-foreground transition-colors"
                    style={{ backgroundColor: 'transparent', border: 'none' }}
                  >
                    <span style={{ fontSize: '18px', fontWeight: 400 }}>Prebid Mobile (Android)</span>
                  </button>
                  <button
                    onClick={() => handleProtectedNavigation('/repos/prebiddocs')}
                    className="w-full flex items-center justify-center py-2 text-muted-foreground hover:text-foreground transition-colors"
                    style={{ backgroundColor: 'transparent', border: 'none' }}
                  >
                    <span style={{ fontSize: '18px', fontWeight: 400 }}>Prebid Documentation</span>
                  </button>
                  
                  {session?.user?.role === 'admin' && (
                    <button
                      onClick={() => handleProtectedNavigation('/admin/users')}
                      className="w-full flex items-center justify-center py-3 text-muted-foreground hover:text-foreground transition-colors"
                      style={{ backgroundColor: 'transparent', border: 'none' }}
                    >
                      <span style={{ fontSize: '20px', fontWeight: 500 }}>Users</span>
                    </button>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
            
            {/* Logo */}
            <div style={{ width: '90px', height: '90px', position: 'relative', overflow: 'visible' }}>
              <Image 
                src="/prebid-logo.png" 
                alt="Prebid Logo" 
                fill
                style={{ objectFit: 'contain', transform: 'scale(1.2)' }}
              />
            </div>
          </div>

          {/* Title, Auth, and Theme Toggle */}
          <div className="flex items-center" style={{ gap: '1rem' }}>
            <h1 className="hidden sm:block" style={{
              fontSize: '1.125rem',
              fontWeight: '500',
              color: 'var(--foreground)',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
              letterSpacing: '-0.025em'
            }}>
              Repo Activity Dashboard
            </h1>

            {/* Auth Section */}
            {status === 'loading' ? (
              <div className="h-10 w-10 rounded-lg bg-accent animate-pulse" />
            ) : session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-10 w-10 rounded-lg border transition-all duration-300 flex items-center justify-center hover:bg-accent">
                    <User className="h-5 w-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{session.user.name || session.user.email}</p>
                      <p className="text-xs leading-none text-muted-foreground">{session.user.email}</p>
                      {session.user.role && (
                        <p className="text-xs leading-none text-muted-foreground capitalize">Role: {session.user.role}</p>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {session.user.role === 'admin' && (
                    <>
                      <DropdownMenuItem onClick={() => router.push('/admin')}>
                        Admin Panel
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={() => signOut()}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                onClick={() => router.push('/auth/login')}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
              >
                Sign In
              </button>
            )}

            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`h-10 w-10 rounded-lg border transition-all duration-300 flex items-center justify-center ${
                theme === 'dark'
                  ? 'bg-gray-900 border-gray-600 hover:bg-gray-800'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Moon className="h-5 w-5 text-blue-400" />
              ) : (
                <Sun className="h-5 w-5 text-yellow-500" />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}