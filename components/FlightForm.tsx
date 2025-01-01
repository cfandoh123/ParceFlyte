// components/FlightForm.tsx
import React, { useState } from 'react';

interface FlightFormProps {
  onClose: () => void;
}

export default function FlightForm({ onClose }: FlightFormProps) {
  const [airline, setAirline] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [capacity, setCapacity] = useState<number>(1);

  const handleSubmit = async () => {
    const res = await fetch('/api/flights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ airline, origin, destination, departureDate, capacity }),
    });
    if (res.ok) {
      alert('Flight logged successfully!');
      onClose();
    } else {
      alert('Error logging flight');
    }
  };

  return (
    <div className="fixed top-0 left-0 flex items-center justify-center w-full h-full bg-gray-800 bg-opacity-75">
      <div className="bg-white p-6 rounded">
        <h2 className="text-xl font-bold mb-4">Log a New Flight</h2>
        <div className="mb-3">
          <label>Airline</label>
          <input
            className="border w-full p-2"
            value={airline}
            onChange={(e) => setAirline(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <label>From</label>
          <input
            className="border w-full p-2"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <label>To</label>
          <input
            className="border w-full p-2"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <label>Departure Date</label>
          <input
            type="datetime-local"
            className="border w-full p-2"
            value={departureDate}
            onChange={(e) => setDepartureDate(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <label>Capacity</label>
          <input
            type="number"
            className="border w-full p-2"
            value={capacity}
            onChange={(e) => setCapacity(+e.target.value)}
          />
        </div>
        <div className="flex justify-end">
          <button onClick={onClose} className="mr-2 border px-4 py-2">Cancel</button>
          <button onClick={handleSubmit} className="bg-blue-600 text-white px-4 py-2">Save</button>
        </div>
      </div>
    </div>
  );
}
