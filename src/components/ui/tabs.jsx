'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

const TabsContext = React.createContext(null);

function Tabs({ value, defaultValue, onValueChange, className, children, ...props }) {
  const [internal, setInternal] = React.useState(defaultValue);
  const active = value !== undefined ? value : internal;

  const select = React.useCallback(
    (next) => {
      if (value === undefined) setInternal(next);
      onValueChange?.(next);
    },
    [value, onValueChange]
  );

  return (
    <TabsContext.Provider value={{ active, select }}>
      <div className={className} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

function TabsList({ className, ...props }) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex h-10 items-center justify-center gap-1 rounded-lg bg-muted p-1 text-muted-foreground',
        className
      )}
      {...props}
    />
  );
}

function TabsTrigger({ value, className, ...props }) {
  const ctx = React.useContext(TabsContext);
  const isActive = ctx?.active === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => ctx?.select(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isActive ? 'bg-background text-foreground shadow-sm' : 'hover:text-foreground',
        className
      )}
      {...props}
    />
  );
}

function TabsContent({ value, className, ...props }) {
  const ctx = React.useContext(TabsContext);
  if (ctx?.active !== value) return null;
  return <div role="tabpanel" className={cn('mt-4 animate-fade-in', className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
