'use client';

import { HandshakeIcon, PackageIcon, SearchCheckIcon, ShieldCheckIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

const steps = [
  {
    icon: <PackageIcon />,
    title: 'List your parcel',
    description:
      'Tell us what you are sending, where it needs to go and by when. Weight, size and declared value take about a minute.',
  },
  {
    icon: <SearchCheckIcon />,
    title: 'Compare carriers',
    description:
      'Every traveller on your route is scored out of 100 on route fit, spare capacity, timing, price and reputation — and you can see exactly how each score was reached.',
  },
  {
    icon: <HandshakeIcon />,
    title: 'Agree a fee',
    description:
      'Make an offer, take a counter-offer, settle on a price. Fees are capped so a delivery never costs a disproportionate share of what you are sending.',
  },
  {
    icon: <ShieldCheckIcon />,
    title: 'Pay on delivery',
    description:
      'Your payment is held in escrow the moment a match is accepted, and released to the carrier only once the parcel arrives.',
  },
];

export const Features = () => {
  return (
    <section id="features" className="container text-center py-24 sm:py-32">
      <h2 className="text-3xl md:text-4xl font-bold">
        How It{' '}
        <span className="inline bg-gradient-to-r from-[#F596D3] to-[#D247BF] text-transparent bg-clip-text">
          Works
        </span>
      </h2>
      <p className="md:w-3/4 mx-auto mt-4 mb-8 text-xl text-muted-foreground">
        Four steps from listing a parcel to confirming it arrived — with a verified carrier and your money protected
        the whole way.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {steps.map(({ icon, title, description }, index) => (
          <Card key={title} className="bg-muted/50">
            <CardHeader>
              <CardTitle className="grid gap-4 place-items-center">
                <span className="relative">
                  {icon}
                  <span className="absolute -right-3 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                </span>
                {title}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">{description}</CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};
