'use client';

import { GiftIcon, MapIcon, MedalIcon, PlaneIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

const features = [
  {
    icon: <MedalIcon />,
    title: 'Accesibility',
    description: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit. Illum quas provident cum',
  },
  {
    icon: <MapIcon />,
    title: 'Community',
    description: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit. Illum quas provident cum',
  },
  {
    icon: <PlaneIcon />,
    title: 'Scalability',
    description: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit. Illum quas provident cum',
  },
  {
    icon: <GiftIcon />,
    title: 'Economics',
    description: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit. Illum quas provident cum',
  },
];

export const Features = () => {
  return (
    <section id="features" className="container text-center py-24 sm:py-32">
      <h2 className="text-3xl md:text-4xl font-bold ">
        How It{' '}
        <span className="inline bg-gradient-to-r from-[#F596D3]  to-[#D247BF] text-transparent bg-clip-text">
          Works{' '}
        </span>
        Step-by-Step Guide
      </h2>
      <p className="md:w-3/4 mx-auto mt-4 mb-8 text-xl text-muted-foreground">
        Lorem ipsum dolor sit amet consectetur, adipisicing elit. Veritatis dolor pariatur sit!
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {features.map(({ icon, title, description }) => (
          <Card key={title} className="bg-muted/50">
            <CardHeader>
              <CardTitle className="grid gap-4 place-items-center">
                {icon}
                {title}
              </CardTitle>
            </CardHeader>
            <CardContent>{description}</CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};
