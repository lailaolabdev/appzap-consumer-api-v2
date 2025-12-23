import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICartModifier {
  id: string;
  name: string;
  price: number;
}

export interface ICartItem {
  _id: mongoose.Types.ObjectId;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  modifiers: ICartModifier[];
  specialInstructions?: string;
  itemTotal: number;
}

export interface IAppliedVoucher {
  voucherId?: mongoose.Types.ObjectId;
  code: string;
  discountAmount: number;
}

export interface IDeepLinkData {
  source?: string;
  referralCode?: string;
  campaignId?: string;
}

export interface ICart extends Document {
  userId: mongoose.Types.ObjectId;
  restaurantId: string;
  restaurantName?: string;
  orderType: 'dine_in' | 'takeaway';
  tableId?: string;
  items: ICartItem[];
  subtotal: number;
  discount: number;
  appliedVoucher?: IAppliedVoucher;
  total: number;
  deepLinkData?: IDeepLinkData;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  calculateTotals(): void;
  addItem(item: Partial<ICartItem>): Promise<ICart>;
  updateItem(itemId: string, quantity: number): Promise<ICart>;
  removeItem(itemId: string): Promise<ICart>;
}

// Sub-schemas
const CartModifierSchema = new Schema<ICartModifier>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const CartItemSchema = new Schema<ICartItem>(
  {
    menuItemId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1, max: 99 },
    modifiers: [CartModifierSchema],
    specialInstructions: { type: String, trim: true, maxlength: 500 },
    itemTotal: { type: Number, required: true, min: 0 },
  },
  { _id: true }
);

const AppliedVoucherSchema = new Schema<IAppliedVoucher>(
  {
    voucherId: { type: Schema.Types.ObjectId, ref: 'Voucher' },
    code: { type: String, required: true },
    discountAmount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const DeepLinkDataSchema = new Schema<IDeepLinkData>(
  {
    source: { type: String },
    referralCode: { type: String },
    campaignId: { type: String },
  },
  { _id: false }
);

// Main Cart Schema
const CartSchema = new Schema<ICart>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    restaurantId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    restaurantName: {
      type: String,
      trim: true,
    },
    orderType: {
      type: String,
      enum: ['dine_in', 'takeaway'],
      required: true,
    },
    tableId: {
      type: String,
      trim: true,
    },
    items: {
      type: [CartItemSchema],
      default: [],
    },
    subtotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    appliedVoucher: {
      type: AppliedVoucherSchema,
    },
    total: {
      type: Number,
      default: 0,
      min: 0,
    },
    deepLinkData: {
      type: DeepLinkDataSchema,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
      default: () => new Date(Date.now() + 60 * 60 * 1000), // 60 minutes
    },
  },
  {
    timestamps: true,
    collection: 'carts',
  }
);

// Indexes
CartSchema.index({ userId: 1, createdAt: -1 });
CartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
CartSchema.index({ restaurantId: 1 });

// Methods
CartSchema.methods.calculateTotals = function (): void {
  this.subtotal = this.items.reduce((sum, item) => sum + item.itemTotal, 0);
  this.total = this.subtotal - this.discount;
};

CartSchema.methods.addItem = async function (
  itemData: Partial<ICartItem>
): Promise<ICart> {
  // Calculate item total
  const modifiersTotal = (itemData.modifiers || []).reduce(
    (sum, mod) => sum + mod.price,
    0
  );
  const itemTotal = (itemData.price! + modifiersTotal) * itemData.quantity!;

  // Create cart item
  const cartItem = {
    menuItemId: itemData.menuItemId!,
    name: itemData.name!,
    price: itemData.price!,
    quantity: itemData.quantity!,
    modifiers: itemData.modifiers || [],
    specialInstructions: itemData.specialInstructions,
    itemTotal,
  };

  this.items.push(cartItem);
  this.calculateTotals();

  return await this.save();
};

CartSchema.methods.updateItem = async function (
  itemId: string,
  quantity: number
): Promise<ICart> {
  const item = this.items.id(itemId);
  if (!item) {
    throw new Error('Cart item not found');
  }

  if (quantity <= 0) {
    // Remove item if quantity is 0
    return await this.removeItem(itemId);
  }

  // Update quantity and recalculate total
  item.quantity = quantity;
  const modifiersTotal = item.modifiers.reduce((sum, mod) => sum + mod.price, 0);
  item.itemTotal = (item.price + modifiersTotal) * quantity;

  this.calculateTotals();

  return await this.save();
};

CartSchema.methods.removeItem = async function (itemId: string): Promise<ICart> {
  this.items.pull(itemId);
  this.calculateTotals();

  return await this.save();
};

// Pre-save middleware
CartSchema.pre('save', function (next) {
  if (this.isModified('items')) {
    this.calculateTotals();
  }
  next();
});

// Model
const Cart: Model<ICart> = mongoose.model<ICart>('Cart', CartSchema);

export default Cart;

