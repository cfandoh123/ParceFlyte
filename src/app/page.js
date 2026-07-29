import { About } from '@/components/home/about';
import { Features } from '@/components/home/features';
import { Hero } from '@/components/home/hero';
import { Navbar } from '@/components/home/navbar';

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <About />
        <Features />
      </main>
    </>
  );
}
