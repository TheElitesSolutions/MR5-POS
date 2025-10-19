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

      // Run debug check right before login attempt
      // debug: API check before login
      try {
        electronAPI.debugAPI();
      } catch (debugError) {
        console.error('Debug API error:', debugError);
      }

      // Test IPC connection first
      // debug: testing IPC auth connection
      let testResult;
      try {
        testResult = await ipcAPI.auth.test();
        // debug: IPC auth test result
      } catch (testError) {
        // debug: IPC auth test failed
        toast({
          title: 'Connection Error',
          description:
            'Failed to connect to authentication service. Please restart the application.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      // Validate test result
      if (!testResult?.success) {
        // debug: auth test returned unsuccessful
        toast({
          title: 'Authentication Service Error',
          description:
            'Authentication service is not responding properly. Please contact support.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      // Proceed with login
      // debug: attempting login with credentials

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
    <div className='flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8'>
      <div className='w-full max-w-md space-y-8'>
        <div className='text-center'>
          <div className='mb-6 flex justify-center'>
            <Image
              src='/the-elites-logo.png'
              alt='The Elites Logo'
              width={200}
              height={200}
              className='h-auto w-48'
              priority
            />
          </div>
          <h1 className='mb-2 text-3xl font-bold text-gray-900'>
            The Elites POS
          </h1>
          <p className='text-gray-600'>Restaurant Management System</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in to your account</CardTitle>
            <CardDescription>
              Enter your username and password to access The Elites POS
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='username'>Username</Label>
                <Input
                  id='username'
                  type='text'
                  placeholder='Enter your username'
                  {...register('username')}
                  className={errors.username ? 'border-red-500' : ''}
                  disabled={isSubmitting}
                />
                {errors.username && (
                  <p className='text-sm text-red-600'>
                    {errors.username.message}
                  </p>
                )}
              </div>

              <div className='space-y-2'>
                <Label htmlFor='password'>Password</Label>
                <Input
                  id='password'
                  type='password'
                  placeholder='Enter your password'
                  {...register('password')}
                  className={errors.password ? 'border-red-500' : ''}
                  disabled={isSubmitting}
                />
                {errors.password && (
                  <p className='text-sm text-red-600'>
                    {errors.password.message}
                  </p>
                )}
              </div>

              {error && (
                <div className='rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700'>
                  {error}
                </div>
              )}

              <Button
                type='submit'
                className='w-full'
                disabled={isLoading || isSubmitting}
              >
                {isLoading || isSubmitting ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>

            <div className='mt-6 text-center'>
              <p className='text-sm text-gray-600'>
                Don&apos;t have an account?{' '}
                <Link
                  href='/register'
                  className='font-medium text-blue-600 hover:text-blue-500'
                >
                  Register here
                </Link>
              </p>
            </div>

            <div className='mt-4 text-center text-xs text-gray-500'>
              <p>🔒 Secure login with enhanced protection</p>
              <p>Rate limited for security</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
