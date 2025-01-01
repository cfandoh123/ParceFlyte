// models/Parcel.ts
import mongoose, { Schema, model, Model } from 'mongoose';

interface IParcel {
  sender: mongoose.Types.ObjectId;  // user who needs to send
  carrier?: mongoose.Types.ObjectId; // flight user who accepted
  description: string;
  origin: string;
  destination: string;
  status: 'requested' | 'in_transit' | 'delivered';
  cost?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const parcelSchema = new Schema<IParcel>({
  sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  carrier: { type: Schema.Types.ObjectId, ref: 'User' },
  description: { type: String, required: true },
  origin: { type: String, required: true },
  destination: { type: String, required: true },
  status: { type: String, default: 'requested' },
  cost: { type: Number, default: 0 }
}, { timestamps: true });

export default (mongoose.models.Parcel as Model<IParcel>) ||
  model<IParcel>('Parcel', parcelSchema);
