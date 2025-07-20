'use client';
import { NavigationMenu, NavigationMenuItem, NavigationMenuList } from '@/components/ui/navigation-menu';
import { useState } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { ArrowRightIcon } from '@radix-ui/react-icons';

import Image from 'next/image';

import Logo from '@/assets/images/logo.png';

const routeList = [
  {
    href: '#about',
    label: 'About',
  },
  {
    href: '#features',
    label: 'Features',
  },
  {
    href: '#testimonials',
    label: 'Testimonials',
  },
  {
    href: '#faq',
    label: 'FAQ',
  },
];

export const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <header className="sticky border-b-[1px] top-0 z-40 w-full bg-white dark:border-b-slate-700 dark:bg-background">
      <NavigationMenu className="mx-auto">
        <NavigationMenuList className="container h-14 px-4 w-screen flex justify-between ">
          <NavigationMenuItem className="font-bold flex">
            <a href="/" target="_self" className="ml-2 font-bold text-xl flex items-center">
              <Image src={Logo} className="h-12 w-auto" />
              {/* <img src={Logo} className="h-16" /> */}

              <span>Parceflyte</span>
            </a>
          </NavigationMenuItem>

          {/* desktop */}
          <nav className="hidden md:flex gap-2">
            {routeList.map((route, i) => (
              <a
                href={route.href}
                key={i}
                className={`text-[17px] ${buttonVariants({
                  variant: 'ghost',
                })}`}>
                {route.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex gap-2">
            <a href="/login" target="_self" className={`border ${buttonVariants({ variant: 'secondary' })}`}>
              <ArrowRightIcon className="mr-2 w-5 h-5" />
              Get Started
            </a>
          </div>
        </NavigationMenuList>
      </NavigationMenu>
    </header>
  );
};
