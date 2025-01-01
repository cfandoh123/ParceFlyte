// pages/api/parcels/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { dbConnect } from '@/lib/dbConnect';
import Parcel from '@/models/Parcel';
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
        const { description, origin, destination } = req.body;
        const userId = session.user.sub; 

        const parcel = await Parcel.create({
          sender: userId,
          description,
          origin,
          destination,
          status: 'requested',
        });
        return res.status(201).json(parcel);
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }

    case 'GET':
      try {
        const parcels = await Parcel.find().populate('sender').populate('carrier');
        return res.status(200).json(parcels);
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
