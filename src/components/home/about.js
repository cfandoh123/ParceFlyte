'use client';

import Logo from '@/assets/images/logo.png';
import Image from 'next/image';

export const About = () => {
  return (
    <section id="about" className="container py-24 sm:py-32">
      <div className="bg-muted/50 border rounded-lg py-12">
        <div className="px-6 flex flex-col-reverse md:flex-row gap-8 md:gap-12">
          <Image src={Logo} alt="" className="w-[500px] rounded-lg" />
          <div className="bg-green-0 flex flex-col justify-between">
            <div className="pb-6">
              <h2 className="text-3xl md:text-4xl font-bold">
                <span className="bg-gradient-to-b from-primary/60 to-primary text-transparent bg-clip-text">
                  About{' '}
                </span>
                Parceflyte
              </h2>
              <p className="text-xl text-muted-foreground mt-4">
                Millions of people fly every day with half-empty luggage allowances, while parcels sit waiting for
                couriers that are slow, expensive, or simply do not serve the route. ParceFlyte closes that gap.
              </p>
              <p className="text-xl text-muted-foreground mt-4">
                Senders list what they need delivered. Travellers share the trip they were already taking. Our matching
                engine scores every possible pairing on route, capacity, timing, price and reputation, so both sides can
                see exactly why a match was suggested. Identity checks, a negotiated fee and escrowed payment do the
                rest.
              </p>
            </div>

            <Statistics />
          </div>
        </div>
      </div>
    </section>
  );
};

const Statistics = () => {
  const stats = [
    {
      quantity: '20k Tons',
      description: 'reduction in CO2 Emissions',
    },
    {
      quantity: '2.7K+',
      description: 'Users',
    },
    {
      quantity: '5K+',
      description: 'Deliveries',
    },
  ];

  return (
    <section id="statistics">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 ">
        {stats.map(({ quantity, description }) => (
          <div key={description} className="space-y-2 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold ">{quantity}</h2>
            <p className="text-xl text-muted-foreground">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
};
