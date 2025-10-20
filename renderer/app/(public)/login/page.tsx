'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

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
    <div className='flex min-h-screen items-center justify-center bg-background px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16'>
      <div className='w-full max-w-md space-y-6 sm:space-y-8'>
        {/* Logo and Title Section */}
        <div className='text-center'>
          <div className='mb-6 flex justify-center sm:mb-8'>
            <Image
              src='/the-elites-logo.png'
              alt='The Elites Logo'
              width={200}
              height={200}
              className='h-auto w-24 sm:w-32 md:w-40 lg:w-48'
              priority
            />
          </div>
          <h1 className='mb-2 text-2xl font-bold text-gray-900 sm:mb-3 sm:text-3xl lg:text-4xl'>
            The Elites POS
          </h1>
          <p className='text-sm text-muted-foreground sm:text-base'>
            Restaurant Management System
          </p>
        </div>

        {/* Login Card */}
        <Card className='shadow-lg'>
          <CardHeader className='space-y-1 px-4 py-5 sm:px-6 sm:py-6'>
            <CardTitle className='text-xl sm:text-2xl'>
              Sign in to your account
            </CardTitle>
            <CardDescription className='text-sm sm:text-base'>
              Enter your username and password to access The Elites POS
            </CardDescription>
          </CardHeader>
          <CardContent className='px-4 pb-5 sm:px-6 sm:pb-6'>
            <form onSubmit={handleSubmit(onSubmit)} className='space-y-4 sm:space-y-6'>
              {/* Username Field */}
              <div className='space-y-2 sm:space-y-3'>
                <Label htmlFor='username' className='text-sm font-medium sm:text-base'>
                  Username
                </Label>
                <Input
                  id='username'
                  type='text'
                  placeholder='Enter your username'
                  {...register('username')}
                  className={`h-10 text-sm sm:h-11 sm:text-base ${
                    errors.username ? 'border-destructive' : ''
                  }`}
                  disabled={isSubmitting}
                />
                {errors.username && (
                  <p className='text-xs text-destructive sm:text-sm'>
                    {errors.username.message}
                  </p>
                )}
              </div>

              {/* Password Field */}
              <div className='space-y-2 sm:space-y-3'>
                <Label htmlFor='password' className='text-sm font-medium sm:text-base'>
                  Password
                </Label>
                <Input
                  id='password'
                  type='password'
                  placeholder='Enter your password'
                  {...register('password')}
                  className={`h-10 text-sm sm:h-11 sm:text-base ${
                    errors.password ? 'border-destructive' : ''
                  }`}
                  disabled={isSubmitting}
                />
                {errors.password && (
                  <p className='text-xs text-destructive sm:text-sm'>
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className='rounded border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive sm:px-4 sm:py-3 sm:text-sm'>
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <Button
                type='submit'
                className='h-10 w-full text-sm sm:h-11 sm:text-base'
                disabled={isLoading || isSubmitting}
              >
                {isLoading || isSubmitting ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>

            {/* Commented out until register page is implemented
            <div className='mt-6 text-center sm:mt-8'>
              <p className='text-xs text-muted-foreground sm:text-sm'>
                Don&apos;t have an account?{' '}
                <Link
                  href='/register'
                  className='font-medium text-primary hover:text-primary/90'
                >
                  Register here
                </Link>
              </p>
            </div>
            */}

            {/* Security Notice */}
            <div className='mt-4 space-y-1 text-center text-xs text-muted-foreground sm:mt-6'>
              <p>🔒 Secure login with enhanced protection</p>
              <p>Rate limited for security</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
