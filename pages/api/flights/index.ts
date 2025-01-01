// pages/api/flights/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { dbConnect } from '@/lib/dbConnect';
import Flight from '@/models/Flight';
import { getSession } from '@auth0/nextjs-auth0';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = getSession(req, res);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  await dbConnect();

  const { method } = req;

  switch (method) {
    case 'POST':
      try {
        const { airline, origin, destination, departureDate, capacity } = req.body;
        // user sub from session
        const userId = session.user.sub; 

        const flight = await Flight.create({
          user: userId,
          airline,
          origin,
          destination,
          departureDate,
          capacity,
        });
        return res.status(201).json(flight);
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }

    case 'GET':
      try {
        const flights = await Flight.find().populate('user');
        return res.status(200).json(flights);
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
