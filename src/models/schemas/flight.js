import { Schema } from 'mongoose';

export const flightSchema = new Schema(
  {
    flightNumber: {
      type: String,
      required: true,
      unique: true,
    },
    airline: {
      type: Schema.Types.ObjectId,
      ref: 'Airline',
      required: true,
    },
    departureAirport: {
      type: Schema.Types.ObjectId,
      ref: 'Airport',
      required: true,
    },
    arrivalAirport: {
      type: Schema.Types.ObjectId,
      ref: 'Airport',
      required: true,
    },
    departureTime: {
      type: Date,
      required: true,
    },
    arrivalTime: {
      type: Date,
      required: true,
    },
    flightDuration: {
      type: Number,
      required: true,
    },
    aircraft: {
      type: Schema.Types.ObjectId,
      ref: 'Aircraft',
      required: true,
    },

    status: {
      type: String,
      enum: ['Scheduled', 'Delayed', 'Canceled', 'Active', 'Arrived'],
      default: 'Scheduled',
    },
  },
  {
    timestamps: true,
  }
);
