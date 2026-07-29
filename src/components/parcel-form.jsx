'use client';

import { useState } from 'react';
import { Loader2, Package } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/lib/use-api';
import { CITY_NAMES } from '@/lib/demo-data';
import { money } from '@/lib/format';

const CATEGORIES = ['documents', 'electronics', 'clothing', 'books', 'food', 'cosmetics', 'other'];
const HANDLING = [
  { value: 'fragile', label: 'Fragile' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'signature_required', label: 'Signature required' },
  { value: 'photo_proof', label: 'Photo proof' },
  { value: 'temperature_controlled', label: 'Temperature controlled' },
];

const defaultDeadline = () => {
  const d = new Date();
  d.setDate(d.getDate() + 21);
  return d.toISOString().slice(0, 10);
};

const EMPTY = {
  title: '',
  description: '',
  originCity: '',
  destinationCity: '',
  weight: '',
  volume: '',
  declaredValue: '',
  category: 'other',
  specialHandling: [],
  recipientName: '',
  recipientPhone: '',
  deliveryDeadline: defaultDeadline(),
  insuranceRequired: false,
};

/** Create-parcel dialog. */
export function ParcelForm({ open, onOpenChange, onCreated }) {
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const set = (key) => (event) => {
    const value = event?.target?.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const toggleHandling = (value) => {
    setForm((f) => ({
      ...f,
      specialHandling: f.specialHandling.includes(value)
        ? f.specialHandling.filter((h) => h !== value)
        : [...f.specialHandling, value],
    }));
  };

  const maxFee = form.declaredValue ? parseFloat(form.declaredValue) * 0.15 : null;

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await apiFetch('/api/parcels', {
        method: 'POST',
        body: {
          title: form.title,
          description: form.description,
          origin: { city: form.originCity },
          recipient: {
            name: form.recipientName,
            phone: form.recipientPhone,
            address: { city: form.destinationCity },
          },
          weight: parseFloat(form.weight),
          volume: parseFloat(form.volume),
          declaredValue: parseFloat(form.declaredValue),
          category: form.category,
          specialHandling: form.specialHandling,
          deliveryDeadline: form.deliveryDeadline,
          insuranceRequired: form.insuranceRequired,
        },
      });
      toast({ title: result.message, description: 'Now find a carrier for it.' });
      setForm(EMPTY);
      onOpenChange(false);
      onCreated?.(result.parcel);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not list the parcel', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            List a parcel
          </DialogTitle>
          <DialogDescription>
            Describe what you are sending. We will score every travelling carrier against it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="title">What are you sending?</Label>
            <Input
              id="title"
              required
              value={form.title}
              onChange={set('title')}
              placeholder="Birthday gift box"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={set('description')}
              placeholder="A wool scarf and a photo book, gift wrapped."
              className="mt-1.5"
              rows={2}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="origin">Collect from</Label>
              <Select id="origin" required value={form.originCity} onChange={set('originCity')} className="mt-1.5">
                <option value="">Select a city…</option>
                {CITY_NAMES.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="destination">Deliver to</Label>
              <Select
                id="destination"
                required
                value={form.destinationCity}
                onChange={set('destinationCity')}
                className="mt-1.5">
                <option value="">Select a city…</option>
                {CITY_NAMES.filter((c) => c !== form.originCity).map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                min="0.1"
                step="0.1"
                required
                value={form.weight}
                onChange={set('weight')}
                placeholder="2.5"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="volume">Volume (litres)</Label>
              <Input
                id="volume"
                type="number"
                min="0.5"
                step="0.5"
                required
                value={form.volume}
                onChange={set('volume')}
                placeholder="12"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="value">Declared value ($)</Label>
              <Input
                id="value"
                type="number"
                min="1"
                step="1"
                required
                value={form.declaredValue}
                onChange={set('declaredValue')}
                placeholder="320"
                className="mt-1.5"
              />
            </div>
          </div>

          {maxFee > 0 && (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              Delivery fees for this parcel are capped at <strong>{money(maxFee)}</strong> — 15% of the declared value.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="category">Category</Label>
              <Select id="category" value={form.category} onChange={set('category')} className="mt-1.5">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="deadline">Deliver by</Label>
              <Input
                id="deadline"
                type="date"
                required
                min={new Date().toISOString().slice(0, 10)}
                value={form.deliveryDeadline}
                onChange={set('deliveryDeadline')}
                className="mt-1.5"
              />
            </div>
          </div>

          <fieldset>
            <legend className="text-sm font-medium">Special handling</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {HANDLING.map(({ value, label }) => {
                const active = form.specialHandling.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleHandling(value)}
                    aria-pressed={active}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input bg-background hover:bg-muted'
                    }`}>
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="recipient">Recipient name</Label>
              <Input
                id="recipient"
                required
                value={form.recipientName}
                onChange={set('recipientName')}
                placeholder="Ngozi Okafor"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="phone">Recipient phone</Label>
              <Input
                id="phone"
                value={form.recipientPhone}
                onChange={set('recipientPhone')}
                placeholder="+234 1 234 5678"
                className="mt-1.5"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.insuranceRequired}
              onChange={set('insuranceRequired')}
              className="h-4 w-4 rounded border-input"
            />
            Insure this parcel (adds 2% of declared value to the fee)
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              List parcel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
