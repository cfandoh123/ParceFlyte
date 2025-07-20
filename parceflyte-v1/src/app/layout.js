import { Toaster } from '@/components/ui/toaster';
import { UserProvider } from '@auth0/nextjs-auth0/client';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Parceflyte',
  description:
    'Parceflyte is a secure online platform that facilitates peer-to-peer delivery of parcels and packages over long distances by leveraging the travel plans of its user community.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <UserProvider>
        <body className={inter.className}>{children}</body>
        <Toaster />
        <time dateTime="2024-10-25" suppressHydrationWarning />
      </UserProvider>
    </html>
  );
}
