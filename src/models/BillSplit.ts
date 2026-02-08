/**
 * Bill Split Model
 * 
 * Supports Group Bill Splitting feature:
 * - Multiple split methods (equal, by item, by percentage, custom)
 * - Real-time participant tracking
 * - Payment status per participant
 * - POS sync for automatic status updates
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

// ============================================================================
// TYPES & ENUMS
// ============================================================================

export type SplitMethod = 
  | 'equal'       // Split bill equally among participants
  | 'by_item'     // Each person pays for their items
  | 'by_percentage' // Custom percentage per person
  | 'custom';     // Custom amount per person

export type SplitSessionStatus = 
  | 'pending'     // Session created, waiting for participants
  | 'active'      // Participants joined, splitting in progress
  | 'locked'      // Split confirmed, waiting for payments
  | 'partially_paid' // Some participants have paid
  | 'completed'   // All payments received
  | 'cancelled';  // Session cancelled

export type ParticipantStatus = 
  | 'invited'     // Invited but not joined
  | 'joined'      // Joined the session
  | 'confirmed'   // Confirmed their share
  | 'paying'      // Payment in progress
  | 'paid'        // Payment completed
  | 'declined';   // Declined to participate

export type POSVersionType = 'v1' | 'v2';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ISplitItem {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  assignedTo: mongoose.Types.ObjectId[];  // User IDs who ordered this item
}

export interface IParticipant {
  joinOrder: number;                      // Order in which they joined (1 = host)
  userId: mongoose.Types.ObjectId;
  name: string;
  phone?: string;
  avatar?: string;
  isHost: boolean;
  status: ParticipantStatus;
  
  // Share calculation
  items?: ISplitItem[];                   // For by_item method
  percentage?: number;                    // For by_percentage method
  customAmount?: number;                  // For custom method
  calculatedAmount: number;               // Final amount to pay
  
  // Payment
  paymentId?: string;
  paymentMethod?: string;
  paidAmount: number;
  paidAt?: Date;
  
  // Timestamps
  invitedAt?: Date;
  joinedAt?: Date;
  confirmedAt?: Date;
}

export interface IBillSplit extends Document {
  // Session identification
  sessionCode: string;                    // Unique 6-char code for joining
  
  // Order reference
  orderId: string;                        // Unified order ID
  posVersion: POSVersionType;
  posOrderId: string;                     // Original POS order ID
  restaurantId: string;
  restaurantName: string;
  tableNumber?: string;
  
  // Bill details
  subtotal: number;
  tax: number;
  serviceCharge: number;
  discount: number;
  totalAmount: number;
  currency: string;
  
  // Items (for by_item split)
  items: ISplitItem[];
  
  // Split configuration
  splitMethod: SplitMethod;
  
  // Participants
  hostId: mongoose.Types.ObjectId;
  participants: IParticipant[];
  maxParticipants: number;
  
  // Status
  status: SplitSessionStatus;
  
  // POS sync
  posSyncStatus: 'pending' | 'synced' | 'failed';
  posSyncedAt?: Date;
  posSyncError?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  completedAt?: Date;
  
  // Virtuals
  isExpired: boolean;
  
  // Methods
  addParticipant(userId: mongoose.Types.ObjectId, name: string, phone?: string): Promise<IBillSplit>;
  removeParticipant(userId: mongoose.Types.ObjectId): Promise<IBillSplit>;
  calculateShares(): Promise<IBillSplit>;
  confirmParticipant(userId: mongoose.Types.ObjectId): Promise<IBillSplit>;
  recordPayment(userId: mongoose.Types.ObjectId, paymentId: string, amount: number, method: string): Promise<IBillSplit>;
  getShareUrl(): string;
}

// ============================================================================
// SCHEMAS
// ============================================================================

const SplitItemSchema = new Schema<ISplitItem>(
  {
    itemId: { type: String, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    assignedTo: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
  },
  { _id: true }
);

const ParticipantSchema = new Schema<IParticipant>(
  {
    joinOrder: { type: Number, default: 1 },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: { type: String, required: true },
    phone: { type: String },
    avatar: { type: String },
    isHost: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['invited', 'joined', 'confirmed', 'paying', 'paid', 'declined'],
      default: 'invited',
    },
    
    // Share calculation
    items: [SplitItemSchema],
    percentage: { type: Number, min: 0, max: 100 },
    customAmount: { type: Number, min: 0 },
    calculatedAmount: { type: Number, default: 0, min: 0 },
    
    // Payment
    paymentId: { type: String },
    paymentMethod: { type: String },
    paidAmount: { type: Number, default: 0, min: 0 },
    paidAt: { type: Date },
    
    // Timestamps
    invitedAt: { type: Date },
    joinedAt: { type: Date },
    confirmedAt: { type: Date },
  },
  { _id: true }
);

const BillSplitSchema = new Schema<IBillSplit>(
  {
    // Session identification
    sessionCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      index: true,
    },
    
    // Order reference
    orderId: {
      type: String,
      required: true,
      index: true,
    },
    posVersion: {
      type: String,
      enum: ['v1', 'v2'],
      required: true,
    },
    posOrderId: {
      type: String,
      required: true,
    },
    restaurantId: {
      type: String,
      required: true,
    },
    restaurantName: {
      type: String,
      required: true,
    },
    tableNumber: { type: String },
    
    // Bill details
    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    serviceCharge: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'LAK' },
    
    // Items
    items: [SplitItemSchema],
    
    // Split configuration
    splitMethod: {
      type: String,
      enum: ['equal', 'by_item', 'by_percentage', 'custom'],
      default: 'equal',
    },
    
    // Participants
    hostId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    participants: [ParticipantSchema],
    maxParticipants: {
      type: Number,
      default: 10,
      min: 2,
      max: 20,
    },
    
    // Status
    status: {
      type: String,
      enum: ['pending', 'active', 'locked', 'partially_paid', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    
    // POS sync
    posSyncStatus: {
      type: String,
      enum: ['pending', 'synced', 'failed'],
      default: 'pending',
    },
    posSyncedAt: { type: Date },
    posSyncError: { type: String },
    
    // Timestamps
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    completedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'bill_splits',
  }
);

// ============================================================================
// INDEXES
// ============================================================================

BillSplitSchema.index({ hostId: 1, status: 1, createdAt: -1 });
BillSplitSchema.index({ 'participants.userId': 1, status: 1 });
BillSplitSchema.index({ restaurantId: 1, status: 1 });
BillSplitSchema.index({ status: 1, expiresAt: 1 });

// ============================================================================
// STATICS
// ============================================================================

interface IBillSplitModel extends Model<IBillSplit> {
  generateSessionCode(): string;
  findByCode(code: string): Promise<IBillSplit | null>;
  findActiveForUser(userId: string): Promise<IBillSplit[]>;
  findExpiredSessions(): Promise<IBillSplit[]>;
}

/**
 * Generate unique 6-character session code
 */
BillSplitSchema.statics.generateSessionCode = function (): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * Find session by code
 */
BillSplitSchema.statics.findByCode = async function (code: string): Promise<IBillSplit | null> {
  return this.findOne({ 
    sessionCode: code.toUpperCase(),
    status: { $nin: ['cancelled', 'completed'] },
  });
};

/**
 * Find active sessions for user
 */
BillSplitSchema.statics.findActiveForUser = async function (userId: string): Promise<IBillSplit[]> {
  return this.find({
    $or: [
      { hostId: userId },
      { 'participants.userId': userId },
    ],
    status: { $nin: ['cancelled', 'completed'] },
  }).sort({ createdAt: -1 });
};

/**
 * Find expired sessions
 */
BillSplitSchema.statics.findExpiredSessions = async function (): Promise<IBillSplit[]> {
  return this.find({
    status: { $nin: ['cancelled', 'completed'] },
    expiresAt: { $lt: new Date() },
  });
};

// ============================================================================
// METHODS
// ============================================================================

/**
 * Add participant to session
 */
BillSplitSchema.methods.addParticipant = async function (
  userId: mongoose.Types.ObjectId,
  name: string,
  phone?: string
): Promise<IBillSplit> {
  // Check if session accepts participants
  if (!['pending', 'active'].includes(this.status)) {
    throw new Error(`Cannot add participants to session with status: ${this.status}`);
  }
  
  // Check max participants
  if (this.participants.length >= this.maxParticipants) {
    throw new Error(`Maximum participants (${this.maxParticipants}) reached`);
  }
  
  // Check if already a participant
  const existing = this.participants.find(
    (p: IParticipant) => p.userId.toString() === userId.toString()
  );
  if (existing) {
    if (existing.status === 'declined') {
      existing.status = 'joined';
      existing.joinedAt = new Date();
    }
    return this.save();
  }
  
  // Add new participant
  this.participants.push({
    joinOrder: this.participants.length + 1,
    userId,
    name,
    phone,
    isHost: false,
    status: 'joined',
    calculatedAmount: 0,
    paidAmount: 0,
    joinedAt: new Date(),
  });
  
  // Update status if first non-host participant
  if (this.status === 'pending' && this.participants.length > 1) {
    this.status = 'active';
  }
  
  return this.save();
};

/**
 * Remove participant from session
 */
BillSplitSchema.methods.removeParticipant = async function (
  userId: mongoose.Types.ObjectId
): Promise<IBillSplit> {
  const participant = this.participants.find(
    (p: IParticipant) => p.userId.toString() === userId.toString()
  );
  
  if (!participant) {
    throw new Error('Participant not found');
  }
  
  if (participant.isHost) {
    throw new Error('Cannot remove host from session');
  }
  
  if (participant.status === 'paid') {
    throw new Error('Cannot remove participant who has already paid');
  }
  
  participant.status = 'declined';
  
  return this.save();
};

/**
 * Calculate shares based on split method
 */
BillSplitSchema.methods.calculateShares = async function (): Promise<IBillSplit> {
  const activeParticipants = this.participants.filter(
    (p: IParticipant) => !['declined', 'invited'].includes(p.status)
  );
  
  if (activeParticipants.length === 0) {
    throw new Error('No active participants to calculate shares');
  }
  
  switch (this.splitMethod) {
    case 'equal': {
      const shareAmount = Math.ceil(this.totalAmount / activeParticipants.length);
      activeParticipants.forEach((p: IParticipant, index: number) => {
        // Last person pays remainder to handle rounding
        if (index === activeParticipants.length - 1) {
          const othersTotal = shareAmount * (activeParticipants.length - 1);
          p.calculatedAmount = this.totalAmount - othersTotal;
        } else {
          p.calculatedAmount = shareAmount;
        }
      });
      break;
    }
    
    case 'by_item': {
      activeParticipants.forEach((p: IParticipant) => {
        let itemsTotal = 0;
        this.items.forEach((item: ISplitItem) => {
          const assignees = item.assignedTo || [];
          if (assignees.some((id: mongoose.Types.ObjectId) => id.toString() === p.userId.toString())) {
            // Split item cost among all assignees
            const assigneeCount = assignees.length || 1;
            itemsTotal += Math.ceil(item.totalPrice / assigneeCount);
          }
        });
        
        // Add proportional share of tax, service charge, and discount
        const proportion = itemsTotal / this.subtotal;
        const additionalCharges = (this.tax + this.serviceCharge - this.discount) * proportion;
        p.calculatedAmount = Math.ceil(itemsTotal + additionalCharges);
      });
      break;
    }
    
    case 'by_percentage': {
      activeParticipants.forEach((p: IParticipant) => {
        const percentage = p.percentage || (100 / activeParticipants.length);
        p.calculatedAmount = Math.ceil(this.totalAmount * (percentage / 100));
      });
      break;
    }
    
    case 'custom': {
      // Custom amounts are already set
      activeParticipants.forEach((p: IParticipant) => {
        p.calculatedAmount = p.customAmount || 0;
      });
      break;
    }
  }
  
  return this.save();
};

/**
 * Confirm participant's share
 */
BillSplitSchema.methods.confirmParticipant = async function (
  userId: mongoose.Types.ObjectId
): Promise<IBillSplit> {
  const participant = this.participants.find(
    (p: IParticipant) => p.userId.toString() === userId.toString()
  );
  
  if (!participant) {
    throw new Error('Participant not found');
  }
  
  if (participant.calculatedAmount <= 0) {
    throw new Error('Share amount not calculated yet');
  }
  
  participant.status = 'confirmed';
  participant.confirmedAt = new Date();
  
  // Check if all participants confirmed
  const allConfirmed = this.participants
    .filter((p: IParticipant) => !['declined', 'invited'].includes(p.status))
    .every((p: IParticipant) => ['confirmed', 'paying', 'paid'].includes(p.status));
  
  if (allConfirmed && this.status === 'active') {
    this.status = 'locked';
  }
  
  return this.save();
};

/**
 * Record payment from participant
 */
BillSplitSchema.methods.recordPayment = async function (
  userId: mongoose.Types.ObjectId,
  paymentId: string,
  amount: number,
  method: string
): Promise<IBillSplit> {
  const participant = this.participants.find(
    (p: IParticipant) => p.userId.toString() === userId.toString()
  );
  
  if (!participant) {
    throw new Error('Participant not found');
  }
  
  if (participant.status === 'paid') {
    throw new Error('Participant has already paid');
  }
  
  participant.paymentId = paymentId;
  participant.paymentMethod = method;
  participant.paidAmount = amount;
  participant.paidAt = new Date();
  participant.status = 'paid';
  
  // Check if all participants paid
  const allPaid = this.participants
    .filter((p: IParticipant) => !['declined', 'invited'].includes(p.status))
    .every((p: IParticipant) => p.status === 'paid');
  
  if (allPaid) {
    this.status = 'completed';
    this.completedAt = new Date();
  } else {
    // At least one paid
    const anyPaid = this.participants.some((p: IParticipant) => p.status === 'paid');
    if (anyPaid && this.status !== 'partially_paid') {
      this.status = 'partially_paid';
    }
  }
  
  return this.save();
};

/**
 * Get shareable URL
 */
BillSplitSchema.methods.getShareUrl = function (): string {
  const baseUrl = process.env.APP_BASE_URL || 'https://app.appzap.la';
  return `${baseUrl}/split/${this.sessionCode}`;
};

// ============================================================================
// VIRTUALS
// ============================================================================

BillSplitSchema.virtual('isExpired').get(function () {
  return this.expiresAt < new Date();
});

BillSplitSchema.virtual('participantCount').get(function () {
  return this.participants.filter(
    (p: IParticipant) => !['declined', 'invited'].includes(p.status)
  ).length;
});

BillSplitSchema.virtual('paidCount').get(function () {
  return this.participants.filter((p: IParticipant) => p.status === 'paid').length;
});

BillSplitSchema.virtual('totalPaid').get(function () {
  return this.participants.reduce((sum: number, p: IParticipant) => sum + (p.paidAmount || 0), 0);
});

BillSplitSchema.virtual('remainingAmount').get(function () {
  return this.totalAmount - (this as any).totalPaid;
});

// ============================================================================
// PRE-SAVE HOOKS
// ============================================================================

BillSplitSchema.pre('save', async function (next) {
  // Generate session code if new
  if (this.isNew && !this.sessionCode) {
    let code: string;
    let exists = true;
    while (exists) {
      code = (this.constructor as IBillSplitModel).generateSessionCode();
      exists = !!(await (this.constructor as IBillSplitModel).findOne({ sessionCode: code }));
    }
    this.sessionCode = code!;
  }
  
  // Set expiration (4 hours from creation)
  if (this.isNew && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
  }
  
  next();
});

// ============================================================================
// MODEL
// ============================================================================

const BillSplit: IBillSplitModel = mongoose.model<IBillSplit, IBillSplitModel>(
  'BillSplit',
  BillSplitSchema
);

export default BillSplit;
