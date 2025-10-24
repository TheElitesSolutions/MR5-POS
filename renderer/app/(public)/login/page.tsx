'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ipcAPI } from '@/lib/ipc-api';
import { LoginFormData, loginSchema } from '@/lib/validation';
import { useAuthStore } from '@/stores/authStore';
import { LoginRequest } from '@/types';
import { electronAPI } from '@/utils/electron-api';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { login, isLoading, error, clearError } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  // Debug API state when component mounts
  useEffect(() => {
    // debug: login page mounted
    electronAPI.debugAPI();
  }, []);

  const handleClose = async () => {
    try {
      if (window.electronAPI?.app?.quit) {
        await window.electronAPI.app.quit();
      }
    } catch (error) {
      console.error('Failed to quit app:', error);
    }
  };

  const onSubmit = async (data: LoginFormData) => {
    try {
      setIsSubmitting(true);
      clearError();

      // TEMPORARILY BYPASSED: Auth connection test
      // This test was causing silent failures - bypassing to test actual login
      console.log('[LOGIN] Attempting direct login without auth test...');

      await login(data as LoginRequest);

      toast({
        title: 'Login successful',
        description: 'Welcome back!',
      });

      router.push('/pos');
    } catch (error: any) {
      // debug: login error

      // Display a user-friendly error message
      toast({
        title: 'Login Failed',
        description:
          error?.message ||
          'Authentication failed. Please check your credentials.',
        variant: 'destructive',
      });

      // Error handling is also managed by the auth store
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='flex h-screen items-center justify-center bg-background px-4 py-4 overflow-y-auto relative'>
      {/* Custom Close Button */}
      <button
        onClick={handleClose}
        className='fixed top-2 right-2 z-50 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200 group'
        aria-label='Close application'
        title='Close application'
      >
        <X className='h-5 w-5 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100' />
      </button>

      <div className='w-full max-w-md space-y-3 sm:space-y-4 md:space-y-6 my-4'>
        {/* Logo and Title Section */}
        <div className='text-center'>
          <div className='mb-3 sm:mb-4 md:mb-6 flex justify-center'>
            <Image
              src='/the-elites-logo.png'
              alt='The Elites Logo'
              width={200}
              height={200}
              className='h-auto w-20 sm:w-24 md:w-32 lg:w-40'
              priority
            />
          </div>
          <h1 className='mb-1 sm:mb-2 text-xl sm:text-2xl md:text-3xl font-bold text-gray-900'>
            The Elites POS
          </h1>
          <p className='text-xs sm:text-sm text-muted-foreground'>
            Restaurant Management System
          </p>
        </div>

        {/* Login Card */}
        <Card className='shadow-lg'>
          <CardHeader className='space-y-1 px-4 py-3 sm:py-4 md:px-6 md:py-5'>
            <CardTitle className='text-lg sm:text-xl md:text-2xl'>
              Sign in to your account
            </CardTitle>
            <CardDescription className='text-xs sm:text-sm'>
              Enter your username and password to access The Elites POS
            </CardDescription>
          </CardHeader>
          <CardContent className='px-4 pb-4 sm:pb-5 md:px-6 md:pb-6'>
            <form onSubmit={handleSubmit(onSubmit)} className='space-y-3 sm:space-y-4'>
              {/* Username Field */}
              <div className='space-y-1.5 sm:space-y-2'>
                <Label htmlFor='username' className='text-sm font-medium'>
                  Username
                </Label>
                <Input
                  id='username'
                  type='text'
                  placeholder='Enter your username'
                  {...register('username')}
                  className={`h-9 sm:h-10 text-sm ${
                    errors.username ? 'border-destructive' : ''
                  }`}
                  disabled={isSubmitting}
                />
                {errors.username && (
                  <p className='text-xs text-destructive'>
                    {errors.username.message}
                  </p>
                )}
              </div>

              {/* Password Field */}
              <div className='space-y-1.5 sm:space-y-2'>
                <Label htmlFor='password' className='text-sm font-medium'>
                  Password
                </Label>
                <Input
                  id='password'
                  type='password'
                  placeholder='Enter your password'
                  {...register('password')}
                  className={`h-9 sm:h-10 text-sm ${
                    errors.password ? 'border-destructive' : ''
                  }`}
                  disabled={isSubmitting}
                />
                {errors.password && (
                  <p className='text-xs text-destructive'>
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className='rounded border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive'>
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <Button
                type='submit'
                className='h-9 sm:h-10 w-full text-sm'
                disabled={isLoading || isSubmitting}
              >
                {isLoading || isSubmitting ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>

            {/* Security Notice */}
            <div className='mt-3 sm:mt-4 space-y-0.5 text-center text-xs text-muted-foreground'>
              <p>🔒 Secure login with enhanced protection</p>
              <p>Rate limited for security</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
