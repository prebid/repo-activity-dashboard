'use client';

import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../providers/theme-provider';

export function Toolbar() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex h-16 items-center justify-between">
          {/* Logo/Brand */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-xl">P</span>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold">
                Prebid Analytics
              </span>
              <span className="text-xs text-muted-foreground">
                Repository Dashboard
              </span>
            </div>
          </div>

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
    </header>
  );
}