'use client';

import { useState } from 'react';
import { Loader2, Plane } from 'lucide-react';

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

const MODES = [
  { value: 'air', label: 'Flight' },
  { value: 'land', label: 'Road or rail' },
  { value: 'sea', label: 'Sea' },
  { value: 'mixed', label: 'Mixed' },
];

const TRANSPORT_BY_MODE = {
  air: ['plane'],
  land: ['train', 'bus', 'car'],
  sea: ['ship'],
  mixed: ['other'],
};

const inDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const EMPTY = {
  departureCity: '',
  arrivalCity: '',
  travelMode: 'air',
  operator: '',
  reference: '',
  departureDate: inDays(7),
  arrivalDate: inDays(7),
  weight: '',
  volume: '',
  baseDeliveryFee: '',
  notes: '',
};

/** Post-a-trip dialog. */
export function TravelForm({ open, onOpenChange, onCreated }) {
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await apiFetch('/api/travels', {
        method: 'POST',
        body: {
          departureLocation: { city: form.departureCity },
          arrivalLocation: { city: form.arrivalCity },
          travelMode: form.travelMode,
          transportDetails: {
            type: TRANSPORT_BY_MODE[form.travelMode][0],
            carrier: form.operator,
            reference: form.reference,
          },
          departureDate: form.departureDate,
          arrivalDate: form.arrivalDate,
          availableCapacity: { weight: parseFloat(form.weight), volume: parseFloat(form.volume) },
          baseDeliveryFee: parseFloat(form.baseDeliveryFee),
          notes: form.notes,
          status: 'planned',
        },
      });
      toast({ title: result.message, description: 'Senders on this route can now find you.' });
      setForm(EMPTY);
      onOpenChange(false);
      onCreated?.(result.travel);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not post the trip', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5" />
            Post a trip
          </DialogTitle>
          <DialogDescription>
            Share the route you are already taking and earn from the luggage space you are not using.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="from">Travelling from</Label>
              <Select id="from" required value={form.departureCity} onChange={set('departureCity')} className="mt-1.5">
                <option value="">Select a city…</option>
                {CITY_NAMES.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="to">Travelling to</Label>
              <Select id="to" required value={form.arrivalCity} onChange={set('arrivalCity')} className="mt-1.5">
                <option value="">Select a city…</option>
                {CITY_NAMES.filter((c) => c !== form.departureCity).map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="departs">Departs</Label>
              <Input
                id="departs"
                type="date"
                required
                min={new Date().toISOString().slice(0, 10)}
                value={form.departureDate}
                onChange={set('departureDate')}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="arrives">Arrives</Label>
              <Input
                id="arrives"
                type="date"
                required
                min={form.departureDate}
                value={form.arrivalDate}
                onChange={set('arrivalDate')}
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="mode">Mode</Label>
              <Select id="mode" value={form.travelMode} onChange={set('travelMode')} className="mt-1.5">
                {MODES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="operator">Operator</Label>
              <Input
                id="operator"
                value={form.operator}
                onChange={set('operator')}
                placeholder="British Airways"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="reference">Reference</Label>
              <Input
                id="reference"
                value={form.reference}
                onChange={set('reference')}
                placeholder="BA075"
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="cap-weight">Spare weight (kg)</Label>
              <Input
                id="cap-weight"
                type="number"
                min="0.5"
                step="0.5"
                required
                value={form.weight}
                onChange={set('weight')}
                placeholder="12"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="cap-volume">Spare volume (L)</Label>
              <Input
                id="cap-volume"
                type="number"
                min="1"
                step="1"
                required
                value={form.volume}
                onChange={set('volume')}
                placeholder="40"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="fee">Base fee ($)</Label>
              <Input
                id="fee"
                type="number"
                min="1"
                step="1"
                required
                value={form.baseDeliveryFee}
                onChange={set('baseDeliveryFee')}
                placeholder="85"
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes for senders</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={set('notes')}
              placeholder="Happy to take documents and small electronics. No liquids."
              className="mt-1.5"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Post trip
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
