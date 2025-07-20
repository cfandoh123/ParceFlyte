'use client';
import { buttonVariants } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { HeroCards } from './hero-cards';
export const Hero = () => {
  return (
    <section className="container grid lg:grid-cols-2 place-items-center py-20 md:py-32 gap-10">
      <div className="text-center lg:text-start space-y-6">
        <main className="text-5xl md:text-6xl font-bold">
          <h1 className="inline">
            <span className="inline bg-gradient-to-r from-[#F596D3]  to-[#D247BF] text-transparent bg-clip-text">
              Parceflyte
            </span>{' '}
            securely connects your parcel with
          </h1>{' '}
          with{' '}
          <h2 className="inline">
            <span className="inline bg-gradient-to-r from-[#61DAFB] via-[#1fc0f1] to-[#03a3d7] text-transparent bg-clip-text">
              trusted carriers
            </span>{' '}
          </h2>
        </main>

        <p className="text-xl text-muted-foreground md:w-10/12 mx-auto lg:mx-0">
          Parceflyte is a secure online platform that facilitates peer-to-peer delivery of parcels and packages over
          long distances by leveraging the travel plans of its user community.
        </p>

        <div className="space-y-4 md:space-y-0 md:space-x-4">
          <a
            href="/register"
            target="_self"
            className={`w-full md:w-1/3 ${buttonVariants({
              variant: 'default',
            })}`}>
            Join the Community
            <ArrowRight className="ml-2 w-5 h-5" />
          </a>

          <a
            href=""
            target="_self"
            className={`w-full md:w-1/3 ${buttonVariants({
              variant: 'outline',
            })}`}>
            Learn More
            <ArrowRight className="ml-2 w-5 h-5" />
          </a>
        </div>
      </div>

      {/* Hero cards sections */}
      <div className="z-10">
        <HeroCards />
      </div>

      {/* Shadow effect */}
      <div className="shadow"></div>
    </section>
  );
};
