'use client';

import { Navbar } from '@/components/home/navbar';
import { Button, buttonVariants } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToastAction } from '@/components/ui/toast';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { useUser } from '@auth0/nextjs-auth0/client';
import { CalendarIcon, Check, ChevronsUpDown, CirclePlusIcon, Lightbulb, SearchCheckIcon } from 'lucide-react';
import { useState } from 'react';

export default function Dashboard() {
  const { user, error, isLoading } = useUser();

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [date, setDate] = useState(null);

  const data = [
    {
      value: 'UNA',
      label: 'United Airlines',
    },
    {
      value: 'EMR',
      label: 'Emirates',
    },
    {
      value: 'FR',
      label: 'France Airlines',
    },
    {
      value: 'BR',
      label: 'British Airlines',
    },
    {
      value: 'ET',
      label: 'Ethiopian airlines',
    },
  ];

  const [airlines, _] = useState(data);
  const { toast } = useToast();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>{error.message}</div>;
  return (
    <>
      <Navbar />
      <h3 className="text-4xl font-bold my-6 mx-12">
        Welcome,
        <span className="inline bg-gradient-to-r from-[#61DAFB] via-[#1fc0f1] to-[#03a3d7] text-transparent bg-clip-text">
          @username
        </span>
      </h3>
      <section className="actions w-full mt-8 px-8 flex flex-row gap-x-8">
        <Card className=" w-[340px] -top-[15px] drop-shadow-xl shadow-black/10 dark:shadow-white/10">
          <CardHeader className="flex flex-row items-center gap-4 pb-2">
            <div className="flex flex-col">
              <CardTitle className="text-lg">Going Somewhere?</CardTitle>

              <CardDescription className="mt-4">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <CirclePlusIcon className="mr-3" />
                      Log your flight
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>Log a new flight</DialogTitle>
                      <DialogDescription>
                        Add details of your flight and let others know. Click save when you're done.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid py-4">
                      <div className="flex flex-col gap-4 items-start">
                        <Label htmlFor="name" className="text-right">
                          What airline are you travelling?
                        </Label>
                        <Popover open={open} onOpenChange={setOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={open}
                              className="w-full justify-between">
                              {value ? airlines.find((airline) => airline.value === value)?.label : 'Select airline...'}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[200px] p-0">
                            <Command>
                              <CommandInput placeholder="Search airline..." />
                              <CommandEmpty>No such airline.</CommandEmpty>
                              <CommandGroup>
                                {airlines &&
                                  airlines.map((airline) => (
                                    <CommandItem
                                      key={airline.value}
                                      value={airline.value}
                                      onSelect={(currentValue) => {
                                        setValue(currentValue === value ? '' : currentValue);
                                        setOpen(false);
                                      }}>
                                      <Check
                                        className={cn(
                                          'mr-2 h-4 w-4',
                                          value === airline.value ? 'opacity-100' : 'opacity-0'
                                        )}
                                      />
                                      {airline.label}
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="flex flex-row items-start justify-between gap-x-4">
                        <div className="grid grid-rows-2 items-center">
                          <Label htmlFor="name" className="text-right w-full">
                            From
                          </Label>
                          <Input id="name" placeholder="Madrid" className="col-span-3" />
                        </div>
                        <div className="grid grid-rows-2 items-center">
                          <Label htmlFor="username" className="text-right">
                            To
                          </Label>
                          <Input id="username" placeholder="Addis Ababa" className="col-span-3" />
                        </div>
                      </div>
                      <div className="flex flex-row items-start justify-between gap-x-4">
                        <div className="grid grid-rows-2 items-center">
                          <Label htmlFor="name" className="text-left w-full">
                            Date
                          </Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant={'outline'}
                                className={cn(
                                  'w-[280px] justify-start text-left font-normal',
                                  !date && 'text-muted-foreground'
                                )}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date ? format(date, 'PPP') : <span>Pick a date</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                            </PopoverContent>
                          </Popover>{' '}
                        </div>
                        <div className="grid grid-rows-2 items-center">
                          <Label htmlFor="username" className="text-right">
                            Time
                          </Label>
                          <Input id="username" placeholder="21:00" className="col-span-3" />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      {/* <Button type="submit">Save changes</Button> */}
                      <Button
                        // variant="outline"
                        onClick={() => {
                          toast({
                            title: 'Flight logged! ',
                            description: 'Community members can now see your flight plan.',
                            action: <ToastAction altText="Nothing to do">Great</ToastAction>,
                          });
                        }}>
                        Save changes
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            Have some space for a little extra carry? Let the community know where you are going and take the chance to
            grab a parcel.
          </CardContent>
        </Card>

        <Card className=" w-[340px] -top-[15px] drop-shadow-xl shadow-black/10 dark:shadow-white/10">
          <CardHeader className="flex flex-row items-center gap-4 pb-2">
            <div className="flex flex-col">
              <CardTitle className="text-lg">Need to Send?</CardTitle>

              <CardDescription className="mt-4">
                <Button
                  className={`text-black ${buttonVariants({
                    variant: 'outline',
                  })}`}>
                  <SearchCheckIcon className="mr-3" />
                  Find a carrier
                </Button>
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            Have some space for a little extra carry? Let the community know where you are going and take the chance to
            grab a parcel.
          </CardContent>
        </Card>

        <Card className=" w-[340px] -top-[15px] drop-shadow-xl shadow-black/10 bg-gradient-to-r from-[#F596D3]  to-[#D247BF]">
          <CardHeader className="flex flex-row items-center gap-4 pb-2">
            <div className="flex flex-col">
              <CardTitle className="text-lg"></CardTitle>

              <CardDescription className="mt-4">
                <Button
                  className={`text-black ${buttonVariants({
                    variant: 'outline',
                  })}`}>
                  Learn More
                  <Lightbulb className="mr-3" />
                </Button>
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            Hesistant? Find out how parceflyte keeps everything secure and finds trusted members on this platform.
          </CardContent>
        </Card>
      </section>

      <h3 className="text-2xl font-bold my-8 mx-12">What you have been doing recently</h3>
      <section className="history w-full mt-8 px-8 flex flex-row gap-x-8">
        <Card className=" w-[340px] -top-[15px] drop-shadow-xl shadow-black/10 dark:shadow-white/10">
          <CardHeader className="flex flex-row items-center gap-4 pb-2">
            {/* <Avatar>
              <AvatarFallback>SH</AvatarFallback>
            </Avatar> */}

            <div className="flex flex-col">
              <CardTitle className="text-lg"></CardTitle>
              <CardDescription></CardDescription>
            </div>
          </CardHeader>

          <CardContent>This landig page is awesome!</CardContent>
        </Card>
      </section>

      <h3 className="text-2xl font-bold my-8 mx-12">Community News</h3>
    </>
  );
}
