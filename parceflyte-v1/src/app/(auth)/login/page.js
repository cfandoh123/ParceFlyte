'use client';

import { UserAuthForm } from '@/components/auth-form';
import { Navbar } from '@/components/home/navbar';
import Link from 'next/link';

export default function Login() {
  return (
    <>
      <Navbar />

      <section className="h-screen flex flex-row bg-slate-50">
        <section className="featured flex-1 h-full flex items-end justify-center">
          <div className="text-white h-fit w-[80%] pb-32 px-8 rounded-lg">
            <h3 className="text-3xl font-bold py-8 inline bg-gradient-to-r from-[#F596D3]  to-[#D247BF] text-transparent bg-clip-text">
              {' '}
              Find a carrier | Be a carrier
            </h3>

            <p className="pt-8">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et
              dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex
              ea commodo consequat.
            </p>
          </div>
        </section>
        <section className="name flex-1 flex items-center justify-center h-full">
          <div className="lg:p-8">
            <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
              <div className="flex flex-col space-y-2 text-center">
                <h1 className="text-2xl font-semibold tracking-tight">Login to your account</h1>
                <p className="text-sm text-muted-foreground">Get started finding | being a carrier</p>
              </div>
              <UserAuthForm />
              <p className="px-8 text-center text-sm text-muted-foreground">
                Don't have an account? Create one{' '}
                <Link href="/register" target="_self" className="underline underline-offset-4 hover:text-primary">
                  here
                </Link>{' '}
                {/* and{' '}
                <Link href="/privacy" className="underline underline-offset-4 hover:text-primary">
                  Privacy Policy
                </Link> */}
                .
              </p>
            </div>
          </div>
          {/* <Card className="mx-auto max-w-sm">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold">Login</CardTitle>
              <CardDescription>Enter your email and password to login to your account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" placeholder="m@example.com" required type="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" required type="password" />
                </div>

                <a href="/api/auth/login">Login here</a>
                <Button className="w-full" type="submit">
                  Login
                </Button>
              </div>
            </CardContent>
          </Card> */}
        </section>
      </section>
    </>
  );
}
