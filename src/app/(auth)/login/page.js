'use client';

import Link from 'next/link';

import { Navbar } from '@/components/home/navbar';
import { UserAuthForm } from '@/components/auth-form';

export default function Login() {
  return (
    <>
      <Navbar />

      <div className="container relative grid min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center lg:max-w-none lg:grid-cols-2 lg:px-0">
        <div className="featured relative hidden h-full flex-col justify-end p-10 text-white lg:flex">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-20 mb-24">
            <h2 className="bg-gradient-to-r from-[#F596D3] to-[#D247BF] bg-clip-text text-3xl font-bold text-transparent">
              Find a carrier · Be a carrier
            </h2>
            <p className="mt-4 max-w-sm leading-relaxed">
              Send a parcel with someone already making the trip, or earn from the luggage space you are not using.
            </p>
          </div>
        </div>

        <div className="w-full px-4 py-10 lg:p-8">
          <div className="mx-auto flex w-full max-w-sm flex-col justify-center space-y-6">
            <div className="flex flex-col space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
              <p className="text-sm text-muted-foreground">Sign in to your ParceFlyte account</p>
            </div>

            <UserAuthForm mode="login" />

            <p className="text-center text-sm text-muted-foreground">
              New to ParceFlyte?{' '}
              <Link href="/register" className="font-medium underline underline-offset-4 hover:text-primary">
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
