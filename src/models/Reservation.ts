/**
 * Reservation Model
 * 
 * Local storage for table reservations made through the Consumer API.
 * Syncs with both POS V1 and POS V2 systems.
 * 
 * Benefits:
 * - Fast queries for user's reservations
 * - Works even if POS is temporarily unavailable
 * - Supports both POS systems with unified interface
 * - Enables reminder notifications
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

// ============================================================================
// INTERFACES
// ============================================================================

export type ReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'seated'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type POSVersionType = 'v1' | 'v2';

export interface IReservationDeposit {
  required: boolean;
  amount: number;
  paid: boolean;
  paymentId?: string;
  paidAt?: Date;
}

export interface IReservationReminder {
  type: '24h' | '2h' | '30min';
  sentAt?: Date;
  status: 'pending' | 'sent' | 'failed';
}

export interface IReservation extends Document {
  // Identification
  reservationCode: string;
  
  // User
  userId: mongoose.Types.ObjectId;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  
  // Restaurant (unified ID format: v1_xxx or v2_xxx)
  restaurantId: string;
  restaurantName: string;
  restaurantImage?: string;
  posVersion: POSVersionType;
  
  // Table
  tableId?: string;
  tableIds?: string[];
  tableName?: string;
  zone?: string;
  
  // Timing
  date: string;              // YYYY-MM-DD
  time: string;              // HH:mm
  endTime?: string;          // HH:mm
  duration: number;          // Minutes (default 90)
  
  // Guests
  guestCount: number;
  
  // Status
  status: ReservationStatus;
  
  // Deposit
  deposit?: IReservationDeposit;
  
  // Notes
  specialRequests?: string;
  internalNote?: string;
  
  // Source
  source: 'app' | 'web' | 'phone' | 'walk_in';
  
  // POS Sync
  posReservationId?: string;
  posSyncStatus: 'synced' | 'pending' | 'failed';
  posSyncError?: string;
  posSyncedAt?: Date;
  
  // Reminders
  reminders?: IReservationReminder[];
  
  // Timestamps
  confirmedAt?: Date;
  seatedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  confirm(): Promise<IReservation>;
  cancel(reason?: string): Promise<IReservation>;
  markSeated(): Promise<IReservation>;
  markCompleted(): Promise<IReservation>;
}

// ============================================================================
// SCHEMAS
// ============================================================================

const DepositSchema = new Schema<IReservationDeposit>(
  {
    required: { type: Boolean, default: false },
    amount: { type: Number, default: 0, min: 0 },
    paid: { type: Boolean, default: false },
    paymentId: { type: String },
    paidAt: { type: Date },
  },
  { _id: false }
);

const ReminderSchema = new Schema<IReservationReminder>(
  {
    type: {
      type: String,
      enum: ['24h', '2h', '30min'],
      required: true,
    },
    sentAt: { type: Date },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending',
    },
  },
  { _id: false }
);

const ReservationSchema = new Schema<IReservation>(
  {
    reservationCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    
    // User
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerPhone: {
      type: String,
      required: true,
      trim: true,
    },
    customerEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    
    // Restaurant
    restaurantId: {
      type: String,
      required: true,
      index: true,
    },
    restaurantName: {
      type: String,
      required: true,
      trim: true,
    },
    restaurantImage: {
      type: String,
    },
    posVersion: {
      type: String,
      enum: ['v1', 'v2'],
      required: true,
    },
    
    // Table
    tableId: {
      type: String,
    },
    tableIds: [{
      type: String,
    }],
    tableName: {
      type: String,
    },
    zone: {
      type: String,
    },
    
    // Timing
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    time: {
      type: String,
      required: true,
      match: /^\d{2}:\d{2}$/,
    },
    endTime: {
      type: String,
      match: /^\d{2}:\d{2}$/,
    },
    duration: {
      type: Number,
      default: 90,
      min: 30,
      max: 480,
    },
    
    // Guests
    guestCount: {
      type: Number,
      required: true,
      min: 1,
      max: 50,
    },
    
    // Status
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'],
      default: 'pending',
      index: true,
    },
    
    // Deposit
    deposit: {
      type: DepositSchema,
    },
    
    // Notes
    specialRequests: {
      type: String,
      maxlength: 500,
    },
    internalNote: {
      type: String,
      maxlength: 500,
    },
    
    // Source
    source: {
      type: String,
      enum: ['app', 'web', 'phone', 'walk_in'],
      default: 'app',
    },
    
    // POS Sync
    posReservationId: {
      type: String,
      index: true,
    },
    posSyncStatus: {
      type: String,
      enum: ['synced', 'pending', 'failed'],
      default: 'pending',
      index: true,
    },
    posSyncError: {
      type: String,
    },
    posSyncedAt: {
      type: Date,
    },
    
    // Reminders
    reminders: [ReminderSchema],
    
    // Status timestamps
    confirmedAt: { type: Date },
    seatedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    cancellationReason: { type: String },
  },
  {
    timestamps: true,
    collection: 'reservations',
  }
);

// ============================================================================
// INDEXES
// ============================================================================

// Compound indexes for common queries
ReservationSchema.index({ userId: 1, status: 1, date: -1 });
ReservationSchema.index({ restaurantId: 1, date: 1, time: 1 });
ReservationSchema.index({ date: 1, status: 1 });
ReservationSchema.index({ posVersion: 1, posSyncStatus: 1 });

// For reminder processing
ReservationSchema.index({ 'reminders.status': 1, date: 1, time: 1 });

// ============================================================================
// STATICS
// ============================================================================

interface IReservationModel extends Model<IReservation> {
  generateCode(): string;
  findUpcoming(userId: string): Promise<IReservation[]>;
  findNeedingReminders(type: '24h' | '2h' | '30min'): Promise<IReservation[]>;
}

/**
 * Generate unique reservation code
 */
ReservationSchema.statics.generateCode = function (): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RES-${timestamp}-${random}`;
};

/**
 * Find upcoming reservations for a user
 */
ReservationSchema.statics.findUpcoming = async function (
  userId: string
): Promise<IReservation[]> {
  const today = new Date().toISOString().split('T')[0];
  
  return this.find({
    userId,
    status: { $in: ['pending', 'confirmed'] },
    date: { $gte: today },
  })
    .sort({ date: 1, time: 1 })
    .limit(10);
};

/**
 * Find reservations needing reminders
 */
ReservationSchema.statics.findNeedingReminders = async function (
  type: '24h' | '2h' | '30min'
): Promise<IReservation[]> {
  const now = new Date();
  let targetTime: Date;
  
  switch (type) {
    case '24h':
      targetTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      break;
    case '2h':
      targetTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      break;
    case '30min':
      targetTime = new Date(now.getTime() + 30 * 60 * 1000);
      break;
  }
  
  const targetDate = targetTime.toISOString().split('T')[0];
  const targetHour = targetTime.getHours().toString().padStart(2, '0');
  const targetMinute = targetTime.getMinutes().toString().padStart(2, '0');
  const targetTimeStr = `${targetHour}:${targetMinute}`;
  
  return this.find({
    status: { $in: ['pending', 'confirmed'] },
    date: targetDate,
    time: { $lte: targetTimeStr },
    $or: [
      { reminders: { $elemMatch: { type, status: 'pending' } } },
      { reminders: { $not: { $elemMatch: { type } } } },
    ],
  });
};

// ============================================================================
// METHODS
// ============================================================================

/**
 * Confirm the reservation
 */
ReservationSchema.methods.confirm = async function (): Promise<IReservation> {
  this.status = 'confirmed';
  this.confirmedAt = new Date();
  return this.save();
};

/**
 * Cancel the reservation
 */
ReservationSchema.methods.cancel = async function (
  reason?: string
): Promise<IReservation> {
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  if (reason) {
    this.cancellationReason = reason;
  }
  return this.save();
};

/**
 * Mark as seated
 */
ReservationSchema.methods.markSeated = async function (): Promise<IReservation> {
  this.status = 'seated';
  this.seatedAt = new Date();
  return this.save();
};

/**
 * Mark as completed
 */
ReservationSchema.methods.markCompleted = async function (): Promise<IReservation> {
  this.status = 'completed';
  this.completedAt = new Date();
  return this.save();
};

// ============================================================================
// VIRTUALS
// ============================================================================

/**
 * Get full datetime
 */
ReservationSchema.virtual('datetime').get(function () {
  return new Date(`${this.date}T${this.time}`);
});

/**
 * Check if reservation is today
 */
ReservationSchema.virtual('isToday').get(function () {
  const today = new Date().toISOString().split('T')[0];
  return this.date === today;
});

/**
 * Check if reservation is upcoming
 */
ReservationSchema.virtual('isUpcoming').get(function () {
  const now = new Date();
  const reservationDateTime = new Date(`${this.date}T${this.time}`);
  return reservationDateTime > now && ['pending', 'confirmed'].includes(this.status);
});

// ============================================================================
// PRE-SAVE HOOKS
// ============================================================================

ReservationSchema.pre('save', function (next) {
  // Generate reservation code if not set
  if (!this.reservationCode) {
    this.reservationCode = (this.constructor as IReservationModel).generateCode();
  }
  
  // Calculate end time if not set
  if (!this.endTime && this.time && this.duration) {
    const [hours, minutes] = this.time.split(':').map(Number);
    const endMinutes = hours * 60 + minutes + this.duration;
    const endHours = Math.floor(endMinutes / 60) % 24;
    const endMins = endMinutes % 60;
    this.endTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
  }
  
  // Initialize reminders if not set
  if (!this.reminders || this.reminders.length === 0) {
    this.reminders = [
      { type: '24h', status: 'pending' },
      { type: '2h', status: 'pending' },
    ];
  }
  
  next();
});

// ============================================================================
// MODEL
// ============================================================================

const Reservation: IReservationModel = mongoose.model<IReservation, IReservationModel>(
  'Reservation',
  ReservationSchema
);

export default Reservation;
