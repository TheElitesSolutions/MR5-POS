import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
export function LoadingSpinner({ size = 'md', className, text, variant = 'default', }) {
    const sizeClasses = {
        sm: 'h-4 w-4',
        md: 'h-6 w-6',
        lg: 'h-8 w-8',
        xl: 'h-12 w-12',
    };
    if (variant === 'dots') {
        return (<div className={cn('flex flex-col items-center justify-center space-y-3', className)}>
        <div className='flex space-x-1'>
          <div className='h-2 w-2 animate-bounce rounded-full bg-blue-600 [animation-delay:-0.3s]'></div>
          <div className='h-2 w-2 animate-bounce rounded-full bg-blue-600 [animation-delay:-0.15s]'></div>
          <div className='h-2 w-2 animate-bounce rounded-full bg-blue-600'></div>
        </div>
        {text && (<p className='animate-pulse text-sm text-muted-foreground'>{text}</p>)}
      </div>);
    }
    if (variant === 'pulse') {
        return (<div className={cn('flex flex-col items-center justify-center space-y-3', className)}>
        <div className={cn('animate-pulse rounded-full bg-blue-600', sizeClasses[size])}></div>
        {text && (<p className='animate-pulse text-sm text-muted-foreground'>{text}</p>)}
      </div>);
    }
    return (<div className={cn('flex flex-col items-center justify-center space-y-3', className)}>
      <Loader2 className={cn('animate-spin text-blue-600', sizeClasses[size])}/>
      {text && (<p className='animate-pulse text-sm text-muted-foreground'>{text}</p>)}
    </div>);
}
export function PageLoader({ text = 'Loading...' }) {
    return (<div className='flex h-[300px] items-center justify-center duration-100 animate-in fade-in-0'>
      <div className='space-y-4 text-center'>
        <div className='relative'>
          {/* Outer ring */}
          <div className='h-16 w-16 rounded-full border-4 border-gray-200 dark:border-gray-700'></div>
          {/* Inner spinning ring */}
          <div className='absolute left-0 top-0 h-16 w-16 animate-spin rounded-full border-4 border-transparent border-t-blue-600'></div>
        </div>
        <div className='space-y-2'>
          <p className='text-sm font-medium text-gray-900 dark:text-gray-100'>
            {text}
          </p>
          <div className='flex justify-center space-x-1'>
            <div className='h-1 w-1 animate-pulse rounded-full bg-blue-600'></div>
            <div className='h-1 w-1 animate-pulse rounded-full bg-blue-600 [animation-delay:0.2s]'></div>
            <div className='h-1 w-1 animate-pulse rounded-full bg-blue-600 [animation-delay:0.4s]'></div>
          </div>
        </div>
      </div>
    </div>);
}
export function FullPageLoader({ text = 'Loading...' }) {
    return (<div className='flex min-h-screen items-center justify-center bg-gray-50 duration-100 animate-in fade-in-0 dark:bg-gray-900'>
      <div className='space-y-6 text-center'>
        <div className='relative'>
          {/* Outer ring */}
          <div className='h-20 w-20 rounded-full border-4 border-gray-200 dark:border-gray-700'></div>
          {/* Inner spinning ring */}
          <div className='absolute left-0 top-0 h-20 w-20 animate-spin rounded-full border-4 border-transparent border-t-blue-600'></div>
          {/* Center dot */}
          <div className='absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-blue-600'></div>
        </div>
        <div className='space-y-3'>
          <p className='text-lg font-medium text-gray-900 dark:text-gray-100'>
            {text}
          </p>
          <div className='flex justify-center space-x-1'>
            <div className='h-1.5 w-1.5 animate-bounce rounded-full bg-blue-600 [animation-delay:-0.3s]'></div>
            <div className='h-1.5 w-1.5 animate-bounce rounded-full bg-blue-600 [animation-delay:-0.15s]'></div>
            <div className='h-1.5 w-1.5 animate-bounce rounded-full bg-blue-600'></div>
          </div>
        </div>
      </div>
    </div>);
}
// Fast navigation loader that appears instantly
export function NavigationLoader({ text }) {
    return (<div className='duration-50 fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm animate-in fade-in-0 dark:bg-gray-900/95'>
      <div className='space-y-4 text-center'>
        <div className='relative'>
          {/* Fast spinning ring with custom animation */}
          <div className='border-3 h-12 w-12 rounded-full border-gray-200 dark:border-gray-700'></div>
          <div className='border-3 loading-spin absolute left-0 top-0 h-12 w-12 rounded-full border-transparent border-t-blue-600'></div>
          {/* Center pulse dot */}
          <div className='loading-pulse absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600'></div>
        </div>
        <div className='space-y-2'>
          <p className='text-sm font-medium text-gray-900 dark:text-gray-100'>
            {text}
          </p>
          {/* Wave dots indicator */}
          <div className='flex justify-center space-x-1'>
            <div className='loading-wave-1 h-1 w-1 rounded-full bg-blue-600'></div>
            <div className='loading-wave-2 h-1 w-1 rounded-full bg-blue-600'></div>
            <div className='loading-wave-3 h-1 w-1 rounded-full bg-blue-600'></div>
          </div>
        </div>
      </div>
    </div>);
}
