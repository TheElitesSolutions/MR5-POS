'use client';

import * as React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Prevent hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Memoize the current icon to prevent unnecessary re-renders
  const currentIcon = React.useMemo(() => {
    if (!mounted) return <Sun className='h-4 w-4' />;

    if (theme === 'system') {
      return <Monitor className='h-4 w-4' />;
    }
    if (resolvedTheme === 'dark') {
      return <Moon className='h-4 w-4' />;
    }
    return <Sun className='h-4 w-4' />;
  }, [theme, resolvedTheme, mounted]);

  // Memoize the current label to prevent unnecessary re-renders
  const currentLabel = React.useMemo(() => {
    if (!mounted) return 'Loading theme...';

    if (theme === 'system') {
      return `System (${resolvedTheme === 'dark' ? 'Dark' : 'Light'})`;
    }
    return theme === 'dark' ? 'Dark' : 'Light';
  }, [theme, resolvedTheme, mounted]);

  // Cycle through themes: light -> dark -> system -> light
  const handleToggleTheme = React.useCallback(() => {
    if (!mounted) return;

    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  }, [theme, setTheme, mounted]);

  if (!mounted) {
    return (
      <Button variant='ghost' size='sm' className='h-9 w-9'>
        <Sun className='h-4 w-4' />
        <span className='sr-only'>Loading theme...</span>
      </Button>
    );
  }

  return (
    <Button
      variant='ghost'
      size='sm'
      className='h-9 w-9 transition-all duration-200 hover:scale-105 hover:bg-accent/50'
      onClick={handleToggleTheme}
      aria-label={`Current theme: ${currentLabel}. Click to cycle through themes.`}
      title={`Current: ${currentLabel}. Click to cycle: Light → Dark → System`}
    >
      <div className='relative transition-transform duration-200'>{currentIcon}</div>
      <span className='sr-only'>Toggle theme</span>
    </Button>
  );
}
