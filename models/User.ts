// models/User.ts
import mongoose, { Schema, model, Model } from 'mongoose';

interface IUser {
  auth0Id: string;      // or sub from Auth0
  email: string;
  name?: string;
  avatarUrl?: string;
  kycVerified: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const userSchema = new Schema<IUser>({
  auth0Id: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  name: { type: String },
  avatarUrl: { type: String },
  kycVerified: { type: Boolean, default: false },
}, { timestamps: true });

export default (mongoose.models.User as Model<IUser>) ||
  model<IUser>('User', userSchema);
