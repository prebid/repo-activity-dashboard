'use client';

import { Sun, Moon, Menu, Home, Users } from 'lucide-react';
import { useTheme } from '../providers/theme-provider';
import Image from 'next/image';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet';

export function Toolbar() {
  const { resolvedTheme, setTheme } = useTheme();

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
              <SheetContent side="left" className="w-[300px] sm:w-[400px]" style={{ top: 0 }}>
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
                <nav className="mt-8 space-y-2">
                  <a href="/" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-colors">
                    <Home className="h-5 w-5" />
                    <span>Dashboard</span>
                  </a>
                  <a href="/contributors" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-colors">
                    <Users className="h-5 w-5" />
                    <span>Contributors</span>
                  </a>
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

          {/* Title and Theme Toggle */}
          <div className="flex items-center" style={{ gap: '2rem' }}>
            <h1 style={{ 
              fontSize: '1.125rem', 
              fontWeight: '500', 
              color: 'var(--foreground)',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
              letterSpacing: '-0.025em'
            }}>
              Repo Activity Dashboard
            </h1>
            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className={`h-10 w-10 rounded-lg border transition-all duration-300 flex items-center justify-center ${
                resolvedTheme === 'dark' 
                  ? 'bg-gray-900 border-gray-600 hover:bg-gray-800' 
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
              aria-label="Toggle theme"
            >
              {resolvedTheme === 'dark' ? (
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