// models/Flight.ts
import mongoose, { Schema, model, Model } from 'mongoose';

interface IFlight {
  user: mongoose.Types.ObjectId;  // who posted the flight
  airline: string;
  origin: string;
  destination: string;
  departureDate: Date;
  capacity: number;  // how many parcels can be carried
  createdAt?: Date;
  updatedAt?: Date;
}

const flightSchema = new Schema<IFlight>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  airline: { type: String, required: true },
  origin: { type: String, required: true },
  destination: { type: String, required: true },
  departureDate: { type: Date, required: true },
  capacity: { type: Number, default: 1 },
}, { timestamps: true });

export default (mongoose.models.Flight as Model<IFlight>) ||
  model<IFlight>('Flight', flightSchema);
