/**
 * Gift/Voucher Model
 * 
 * Supports Social Gifting feature - buy digital vouchers and send to friends
 * 
 * Features:
 * - Pre-defined gift templates (Digital Coffee, Meal Voucher, etc.)
 * - Custom amount gifts
 * - Shareable via WhatsApp/Link
 * - Redeemable at any AppZap restaurant (or specific one)
 * - Expiration handling
 * - Partial redemption support
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

// ============================================================================
// TYPES & ENUMS
// ============================================================================

export type GiftStatus = 
  | 'pending_payment'  // Created but not paid
  | 'active'           // Paid and ready to be claimed/redeemed
  | 'claimed'          // Recipient has claimed it
  | 'partially_used'   // Some amount has been redeemed
  | 'fully_redeemed'   // Completely used
  | 'expired'          // Past expiration date
  | 'cancelled'        // Cancelled by sender (before claim)
  | 'refunded';        // Refunded to sender

export type GiftType = 
  | 'digital_coffee'   // Fixed amount coffee gift
  | 'meal_voucher'     // Fixed amount meal voucher
  | 'custom_amount'    // User-defined amount
  | 'experience';      // Special dining experience

export type ShareChannel = 'whatsapp' | 'link' | 'sms' | 'email';

// ============================================================================
// INTERFACES
// ============================================================================

export interface IGiftTemplate {
  type: GiftType;
  name: string;
  nameEn?: string;
  description: string;
  descriptionEn?: string;
  amount: number;
  currency: string;
  image: string;
  icon: string;
  isActive: boolean;
  sortOrder: number;
  minAmount?: number;    // For custom_amount type
  maxAmount?: number;    // For custom_amount type
  validDays: number;     // Days until expiration
  restaurantIds?: string[]; // Restrict to specific restaurants (empty = all)
}

export interface IGiftMessage {
  text: string;
  senderName: string;
  recipientName?: string;
}

export interface IGiftRedemption {
  amount: number;
  redeemedAt: Date;
  restaurantId: string;
  restaurantName: string;
  orderId?: string;
  posVersion: 'v1' | 'v2';
  posTransactionId?: string;
}

export interface IGiftShare {
  channel: ShareChannel;
  sharedAt: Date;
  linkClicked?: boolean;
  linkClickedAt?: Date;
}

export interface IGift extends Document {
  // Identification
  giftCode: string;           // Unique code for redemption (e.g., GIFT-XXXX-XXXX)
  shortCode: string;          // Short code for deep links
  
  // Gift Details
  type: GiftType;
  templateId?: string;        // Reference to template if used
  name: string;
  description?: string;
  image?: string;
  icon?: string;
  
  // Value
  originalAmount: number;     // Original gift value
  remainingAmount: number;    // Remaining value (for partial redemption)
  currency: string;
  
  // Sender
  senderId: mongoose.Types.ObjectId;
  senderName: string;
  senderPhone: string;
  
  // Recipient
  recipientPhone?: string;
  recipientEmail?: string;
  recipientName?: string;
  recipientId?: mongoose.Types.ObjectId;  // Set when claimed
  
  // Message
  message?: IGiftMessage;
  
  // Status
  status: GiftStatus;
  
  // Validity
  validFrom: Date;
  expiresAt: Date;
  
  // Restrictions
  restaurantIds?: string[];   // Empty = valid at all restaurants
  minOrderAmount?: number;    // Minimum order to use gift
  
  // Payment
  paymentId?: string;
  paymentMethod?: string;
  paidAt?: Date;
  
  // Sharing
  shareHistory: IGiftShare[];
  lastSharedAt?: Date;
  
  // Redemption
  redemptions: IGiftRedemption[];
  claimedAt?: Date;
  fullyRedeemedAt?: Date;
  
  // Cancellation/Refund
  cancelledAt?: Date;
  cancellationReason?: string;
  refundedAt?: Date;
  refundId?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  claim(userId: mongoose.Types.ObjectId, userName: string): Promise<IGift>;
  redeem(amount: number, restaurantId: string, restaurantName: string, orderId?: string): Promise<IGift>;
  cancel(reason?: string): Promise<IGift>;
  isValidForRestaurant(restaurantId: string): boolean;
  getShareableLink(): string;
}

// ============================================================================
// SCHEMAS
// ============================================================================

const GiftMessageSchema = new Schema<IGiftMessage>(
  {
    text: { type: String, required: true, maxlength: 500 },
    senderName: { type: String, required: true },
    recipientName: { type: String },
  },
  { _id: false }
);

const GiftRedemptionSchema = new Schema<IGiftRedemption>(
  {
    amount: { type: Number, required: true, min: 0 },
    redeemedAt: { type: Date, default: Date.now },
    restaurantId: { type: String, required: true },
    restaurantName: { type: String, required: true },
    orderId: { type: String },
    posVersion: { type: String, enum: ['v1', 'v2'], required: true },
    posTransactionId: { type: String },
  },
  { _id: true }
);

const GiftShareSchema = new Schema<IGiftShare>(
  {
    channel: { 
      type: String, 
      enum: ['whatsapp', 'link', 'sms', 'email'],
      required: true,
    },
    sharedAt: { type: Date, default: Date.now },
    linkClicked: { type: Boolean, default: false },
    linkClickedAt: { type: Date },
  },
  { _id: true }
);

const GiftSchema = new Schema<IGift>(
  {
    // Identification
    giftCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      index: true,
    },
    shortCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    
    // Gift Details
    type: {
      type: String,
      enum: ['digital_coffee', 'meal_voucher', 'custom_amount', 'experience'],
      required: true,
    },
    templateId: { type: String },
    name: { type: String, required: true },
    description: { type: String },
    image: { type: String },
    icon: { type: String },
    
    // Value
    originalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    remainingAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'LAK',
    },
    
    // Sender
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    senderName: { type: String, required: true },
    senderPhone: { type: String, required: true },
    
    // Recipient
    recipientPhone: { type: String, index: true },
    recipientEmail: { type: String, lowercase: true },
    recipientName: { type: String },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    
    // Message
    message: { type: GiftMessageSchema },
    
    // Status
    status: {
      type: String,
      enum: [
        'pending_payment',
        'active',
        'claimed',
        'partially_used',
        'fully_redeemed',
        'expired',
        'cancelled',
        'refunded',
      ],
      default: 'pending_payment',
      index: true,
    },
    
    // Validity
    validFrom: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    
    // Restrictions
    restaurantIds: [{
      type: String,
    }],
    minOrderAmount: {
      type: Number,
      min: 0,
    },
    
    // Payment
    paymentId: { type: String },
    paymentMethod: { type: String },
    paidAt: { type: Date },
    
    // Sharing
    shareHistory: [GiftShareSchema],
    lastSharedAt: { type: Date },
    
    // Redemption
    redemptions: [GiftRedemptionSchema],
    claimedAt: { type: Date },
    fullyRedeemedAt: { type: Date },
    
    // Cancellation/Refund
    cancelledAt: { type: Date },
    cancellationReason: { type: String },
    refundedAt: { type: Date },
    refundId: { type: String },
  },
  {
    timestamps: true,
    collection: 'gifts',
  }
);

// ============================================================================
// INDEXES
// ============================================================================

GiftSchema.index({ senderId: 1, status: 1, createdAt: -1 });
GiftSchema.index({ recipientId: 1, status: 1 });
GiftSchema.index({ recipientPhone: 1, status: 1 });
GiftSchema.index({ status: 1, expiresAt: 1 });
GiftSchema.index({ type: 1, status: 1 });

// ============================================================================
// STATICS
// ============================================================================

interface IGiftModel extends Model<IGift> {
  generateGiftCode(): string;
  generateShortCode(): string;
  findByCode(code: string): Promise<IGift | null>;
  findSentByUser(userId: string, status?: GiftStatus): Promise<IGift[]>;
  findReceivedByUser(userId: string, status?: GiftStatus): Promise<IGift[]>;
  findExpiredGifts(): Promise<IGift[]>;
}

/**
 * Generate unique gift code
 */
GiftSchema.statics.generateGiftCode = function (): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars
  let code = 'GIFT-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  code += '-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * Generate short code for deep links
 */
GiftSchema.statics.generateShortCode = function (): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * Find gift by code (gift code or short code)
 */
GiftSchema.statics.findByCode = async function (code: string): Promise<IGift | null> {
  // Try gift code first
  let gift = await this.findOne({ giftCode: code.toUpperCase() });
  if (gift) return gift;
  
  // Try short code
  gift = await this.findOne({ shortCode: code.toLowerCase() });
  return gift;
};

/**
 * Find gifts sent by user
 */
GiftSchema.statics.findSentByUser = async function (
  userId: string,
  status?: GiftStatus
): Promise<IGift[]> {
  const query: any = { senderId: userId };
  if (status) query.status = status;
  
  return this.find(query).sort({ createdAt: -1 });
};

/**
 * Find gifts received by user
 */
GiftSchema.statics.findReceivedByUser = async function (
  userId: string,
  status?: GiftStatus
): Promise<IGift[]> {
  const query: any = { recipientId: userId };
  if (status) query.status = status;
  
  return this.find(query).sort({ createdAt: -1 });
};

/**
 * Find expired active gifts
 */
GiftSchema.statics.findExpiredGifts = async function (): Promise<IGift[]> {
  return this.find({
    status: { $in: ['active', 'claimed', 'partially_used'] },
    expiresAt: { $lt: new Date() },
  });
};

// ============================================================================
// METHODS
// ============================================================================

/**
 * Claim gift (recipient registers/logs in)
 */
GiftSchema.methods.claim = async function (
  userId: mongoose.Types.ObjectId,
  userName: string
): Promise<IGift> {
  if (this.status !== 'active') {
    throw new Error(`Cannot claim gift with status: ${this.status}`);
  }
  
  if (this.expiresAt < new Date()) {
    this.status = 'expired';
    await this.save();
    throw new Error('Gift has expired');
  }
  
  this.recipientId = userId;
  this.recipientName = userName;
  this.status = 'claimed';
  this.claimedAt = new Date();
  
  return this.save();
};

/**
 * Redeem gift (use at restaurant)
 */
GiftSchema.methods.redeem = async function (
  amount: number,
  restaurantId: string,
  restaurantName: string,
  orderId?: string
): Promise<IGift> {
  if (!['active', 'claimed', 'partially_used'].includes(this.status)) {
    throw new Error(`Cannot redeem gift with status: ${this.status}`);
  }
  
  if (this.expiresAt < new Date()) {
    this.status = 'expired';
    await this.save();
    throw new Error('Gift has expired');
  }
  
  if (amount > this.remainingAmount) {
    throw new Error(`Redemption amount (${amount}) exceeds remaining balance (${this.remainingAmount})`);
  }
  
  if (!this.isValidForRestaurant(restaurantId)) {
    throw new Error('Gift is not valid at this restaurant');
  }
  
  // Determine POS version from restaurant ID
  const posVersion = restaurantId.startsWith('v1_') ? 'v1' : 'v2';
  
  // Add redemption record
  this.redemptions.push({
    amount,
    redeemedAt: new Date(),
    restaurantId,
    restaurantName,
    orderId,
    posVersion,
  });
  
  // Update remaining amount
  this.remainingAmount -= amount;
  
  // Update status
  if (this.remainingAmount === 0) {
    this.status = 'fully_redeemed';
    this.fullyRedeemedAt = new Date();
  } else {
    this.status = 'partially_used';
  }
  
  return this.save();
};

/**
 * Cancel gift
 */
GiftSchema.methods.cancel = async function (reason?: string): Promise<IGift> {
  if (!['pending_payment', 'active'].includes(this.status)) {
    throw new Error(`Cannot cancel gift with status: ${this.status}`);
  }
  
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  if (reason) {
    this.cancellationReason = reason;
  }
  
  return this.save();
};

/**
 * Check if gift is valid at a restaurant
 */
GiftSchema.methods.isValidForRestaurant = function (restaurantId: string): boolean {
  // If no restrictions, valid everywhere
  if (!this.restaurantIds || this.restaurantIds.length === 0) {
    return true;
  }
  
  return this.restaurantIds.includes(restaurantId);
};

/**
 * Get shareable link
 */
GiftSchema.methods.getShareableLink = function (): string {
  const baseUrl = process.env.APP_BASE_URL || 'https://app.appzap.la';
  return `${baseUrl}/gift/${this.shortCode}`;
};

// ============================================================================
// VIRTUALS
// ============================================================================

GiftSchema.virtual('isExpired').get(function () {
  return this.expiresAt < new Date();
});

GiftSchema.virtual('isRedeemable').get(function () {
  return (
    ['active', 'claimed', 'partially_used'].includes(this.status) &&
    this.expiresAt >= new Date() &&
    this.remainingAmount > 0
  );
});

GiftSchema.virtual('usedAmount').get(function () {
  return this.originalAmount - this.remainingAmount;
});

GiftSchema.virtual('daysUntilExpiry').get(function () {
  const now = new Date();
  const diff = this.expiresAt.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// ============================================================================
// PRE-SAVE HOOKS
// ============================================================================

GiftSchema.pre('save', async function (next) {
  // Generate codes if new
  if (this.isNew) {
    if (!this.giftCode) {
      let code: string;
      let exists = true;
      while (exists) {
        code = (this.constructor as IGiftModel).generateGiftCode();
        exists = !!(await (this.constructor as IGiftModel).findOne({ giftCode: code }));
      }
      this.giftCode = code!;
    }
    
    if (!this.shortCode) {
      let code: string;
      let exists = true;
      while (exists) {
        code = (this.constructor as IGiftModel).generateShortCode();
        exists = !!(await (this.constructor as IGiftModel).findOne({ shortCode: code }));
      }
      this.shortCode = code!;
    }
    
    // Set remaining amount to original amount
    if (this.remainingAmount === undefined) {
      this.remainingAmount = this.originalAmount;
    }
  }
  
  next();
});

// ============================================================================
// MODEL
// ============================================================================

const Gift: IGiftModel = mongoose.model<IGift, IGiftModel>('Gift', GiftSchema);

export default Gift;

// ============================================================================
// GIFT TEMPLATES (Pre-defined gift options)
// ============================================================================

export const GIFT_TEMPLATES: IGiftTemplate[] = [
  {
    type: 'digital_coffee',
    name: 'Digital Coffee',
    nameEn: 'Digital Coffee',
    description: 'ເຊີນເພື່ອນດື່ມກາເຟ',
    descriptionEn: 'Treat your friend to a coffee',
    amount: 25000,
    currency: 'LAK',
    image: '/images/gifts/coffee.png',
    icon: '☕',
    isActive: true,
    sortOrder: 1,
    validDays: 90,
  },
  {
    type: 'digital_coffee',
    name: 'Premium Coffee',
    nameEn: 'Premium Coffee',
    description: 'ກາເຟພຣີມຽມສຳລັບເພື່ອນ',
    descriptionEn: 'Premium coffee for your friend',
    amount: 45000,
    currency: 'LAK',
    image: '/images/gifts/premium-coffee.png',
    icon: '☕',
    isActive: true,
    sortOrder: 2,
    validDays: 90,
  },
  {
    type: 'meal_voucher',
    name: 'Lunch Treat',
    nameEn: 'Lunch Treat',
    description: 'ເລ້ຽງອາຫານທ່ຽງ',
    descriptionEn: 'Treat someone to lunch',
    amount: 80000,
    currency: 'LAK',
    image: '/images/gifts/lunch.png',
    icon: '🍱',
    isActive: true,
    sortOrder: 3,
    validDays: 90,
  },
  {
    type: 'meal_voucher',
    name: 'Dinner Voucher',
    nameEn: 'Dinner Voucher',
    description: 'ບັດເຊີນອາຫານຄ່ຳ',
    descriptionEn: 'Dinner voucher for a special meal',
    amount: 150000,
    currency: 'LAK',
    image: '/images/gifts/dinner.png',
    icon: '🍽️',
    isActive: true,
    sortOrder: 4,
    validDays: 90,
  },
  {
    type: 'meal_voucher',
    name: 'Celebration Feast',
    nameEn: 'Celebration Feast',
    description: 'ບັດຂອງຂວັນສຳລັບວັນພິເສດ',
    descriptionEn: 'Gift voucher for special occasions',
    amount: 300000,
    currency: 'LAK',
    image: '/images/gifts/celebration.png',
    icon: '🎉',
    isActive: true,
    sortOrder: 5,
    validDays: 180,
  },
  {
    type: 'custom_amount',
    name: 'Custom Gift',
    nameEn: 'Custom Gift',
    description: 'ເລືອກຈຳນວນເງິນເອງ',
    descriptionEn: 'Choose your own amount',
    amount: 0,
    currency: 'LAK',
    image: '/images/gifts/custom.png',
    icon: '🎁',
    isActive: true,
    sortOrder: 10,
    minAmount: 10000,
    maxAmount: 1000000,
    validDays: 90,
  },
];
