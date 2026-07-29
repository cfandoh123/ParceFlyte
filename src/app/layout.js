import { Toaster } from '@/components/ui/toaster';
import { SessionProvider } from '@/components/session-provider';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'ParceFlyte — peer-to-peer parcel delivery',
  description:
    'ParceFlyte connects senders with verified travellers who have spare luggage capacity, with intelligent matching, fee negotiation and escrowed payments.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider>
          {children}
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  );
}
