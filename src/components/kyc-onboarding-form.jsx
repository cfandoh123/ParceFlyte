import { useState } from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Alert } from './ui/alert';

export default function KYCOnboardingForm({ onSuccess }) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    nationality: '',
    gender: '',
    street: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
    phoneNumber: '',
    email: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);
    // Validate required fields
    if (!form.firstName || !form.lastName || !form.dateOfBirth || !form.street || !form.city || !form.state || !form.country || !form.phoneNumber || !form.email) {
      setError('Please fill in all required fields.');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalInfo: {
            firstName: form.firstName,
            lastName: form.lastName,
            dateOfBirth: form.dateOfBirth,
            nationality: form.nationality,
            gender: form.gender,
          },
          address: {
            currentAddress: {
              street: form.street,
              city: form.city,
              state: form.state,
              country: form.country,
              postalCode: form.postalCode,
            },
          },
          contactInfo: {
            phoneNumber: form.phoneNumber,
            email: form.email,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setSuccess(true);
      if (onSuccess) onSuccess(data.kyc);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error && <Alert variant="destructive">{error}</Alert>}
      {success && <Alert variant="success">KYC application submitted! Proceed to document upload.</Alert>}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="firstName">First Name *</Label>
          <Input id="firstName" name="firstName" value={form.firstName} onChange={handleChange} required />
        </div>
        <div>
          <Label htmlFor="lastName">Last Name *</Label>
          <Input id="lastName" name="lastName" value={form.lastName} onChange={handleChange} required />
        </div>
        <div>
          <Label htmlFor="dateOfBirth">Date of Birth *</Label>
          <Input id="dateOfBirth" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleChange} required />
        </div>
        <div>
          <Label htmlFor="nationality">Nationality</Label>
          <Input id="nationality" name="nationality" value={form.nationality} onChange={handleChange} />
        </div>
        <div>
          <Label htmlFor="gender">Gender</Label>
          <select id="gender" name="gender" value={form.gender} onChange={handleChange} className="w-full border rounded px-2 py-2">
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </div>
        <div>
          <Label htmlFor="phoneNumber">Phone Number *</Label>
          <Input id="phoneNumber" name="phoneNumber" value={form.phoneNumber} onChange={handleChange} required />
        </div>
        <div>
          <Label htmlFor="email">Email *</Label>
          <Input id="email" name="email" type="email" value={form.email} onChange={handleChange} required />
        </div>
      </div>
      <div className="pt-2 font-semibold">Address</div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="street">Street *</Label>
          <Input id="street" name="street" value={form.street} onChange={handleChange} required />
        </div>
        <div>
          <Label htmlFor="city">City *</Label>
          <Input id="city" name="city" value={form.city} onChange={handleChange} required />
        </div>
        <div>
          <Label htmlFor="state">State *</Label>
          <Input id="state" name="state" value={form.state} onChange={handleChange} required />
        </div>
        <div>
          <Label htmlFor="country">Country *</Label>
          <Input id="country" name="country" value={form.country} onChange={handleChange} required />
        </div>
        <div>
          <Label htmlFor="postalCode">Postal Code</Label>
          <Input id="postalCode" name="postalCode" value={form.postalCode} onChange={handleChange} />
        </div>
      </div>
      <Button type="submit" disabled={loading} className="w-full mt-4">
        {loading ? 'Submitting...' : 'Submit KYC Application'}
      </Button>
    </form>
  );
} 