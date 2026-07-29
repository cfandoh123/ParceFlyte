'use client';

import { useState } from 'react';
import Link from 'next/link';

import { Navbar } from '@/components/home/navbar';
import { UserAuthForm } from '@/components/auth-form';
import KYCStepperModal from '@/components/kyc-stepper-modal';
import { QuoteIcon } from 'lucide-react';

export default function Register() {
  const [showKYCModal, setShowKYCModal] = useState(false);

  const handleRegistrationSuccess = () => {
    // Show KYC modal after successful registration
    setShowKYCModal(true);
  };

  const handleKYCComplete = (kycData) => {
    // Redirect to dashboard or show success message
    console.log('KYC completed:', kycData);
    // You can redirect to dashboard here
    // router.push('/dashboard');
  };

  return (
    <>
      <Navbar />

      <div className="container relative hidden h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
        <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex">
          <div
            className="absolute inset-0 bg-cover"
            style={{
              backgroundImage: 'url(https://images.unsplash.com/photo-1604629142630-11d209431dd7)',
            }}
          />
          <div className="relative z-20 mt-auto mb-32">
            <blockquote className="space-y-2">
              <p className="text-lg">
                <QuoteIcon></QuoteIcon>
                Parceflyte is a secure online platform that facilitates peer-to-peer delivery of parcels and packages
                over long distances by leveraging the travel plans of its user community.
                <QuoteIcon></QuoteIcon>
              </p>
            </blockquote>
          </div>
        </div>
        <div className="lg:p-8">
          <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
            <div className="flex flex-col space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
              <p className="text-sm text-muted-foreground">Enter your email below to create your account</p>
            </div>
            <UserAuthForm onSuccess={handleRegistrationSuccess} />
            <p className="px-8 text-center text-sm text-muted-foreground">
              By clicking continue, you agree to our{' '}
              <Link href="/terms" className="underline underline-offset-4 hover:text-primary">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="underline underline-offset-4 hover:text-primary">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </div>

      {/* KYC Onboarding Modal */}
      <KYCStepperModal
        isOpen={showKYCModal}
        onClose={() => setShowKYCModal(false)}
        onComplete={handleKYCComplete}
      />
    </>
  );
}
