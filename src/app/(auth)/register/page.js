'use client';

import Link from 'next/link';
import { Quote } from 'lucide-react';

import { Navbar } from '@/components/home/navbar';
import { UserAuthForm } from '@/components/auth-form';

export default function Register() {
  return (
    <>
      <Navbar />

      <div className="container relative grid min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center lg:max-w-none lg:grid-cols-2 lg:px-0">
        {/* Editorial panel — decorative, so it drops away on small screens */}
        <div className="relative hidden h-full flex-col bg-muted p-10 text-white lg:flex">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1604629142630-11d209431dd7)' }}
          />
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-20 mb-24 mt-auto">
            <Quote className="mb-3 h-8 w-8 opacity-70" />
            <blockquote className="space-y-2">
              <p className="text-lg leading-relaxed">
                ParceFlyte connects senders with travellers who already have spare luggage space — with verified
                identities, transparent scoring and payment held in escrow until delivery.
              </p>
            </blockquote>
          </div>
        </div>

        <div className="w-full px-4 py-10 lg:p-8">
          <div className="mx-auto flex w-full max-w-sm flex-col justify-center space-y-6">
            <div className="flex flex-col space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
              <p className="text-sm text-muted-foreground">Enter your email below to get started</p>
            </div>

            <UserAuthForm mode="register" />

            <p className="px-6 text-center text-sm text-muted-foreground">
              By continuing you agree to our{' '}
              <Link href="/terms" className="underline underline-offset-4 hover:text-primary">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="underline underline-offset-4 hover:text-primary">
                Privacy Policy
              </Link>
              .
            </p>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="font-medium underline underline-offset-4 hover:text-primary">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
