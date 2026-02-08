/**
 * Unified Data Types for AppZap Consumer API V2
 * These types provide a consistent interface across POS V1 and POS V2
 */

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export type POSVersion = 'v1' | 'v2';

export const POS_VERSION = {
  V1: 'v1' as POSVersion,
  V2: 'v2' as POSVersion,
} as const;

// Unified Order Status (mapped from both POS versions)
export type UnifiedOrderStatus =
  | 'pending'      // Just created
  | 'confirmed'    // Accepted by restaurant
  | 'preparing'    // Being prepared in kitchen
  | 'ready'        // Ready for pickup/serving
  | 'served'       // Delivered to customer
  | 'completed'    // Fully completed and paid
  | 'cancelled';   // Cancelled

// Unified Payment Status
export type UnifiedPaymentStatus =
  | 'pending'
  | 'partial'
  | 'paid'
  | 'refunded'
  | 'failed';

// Unified Reservation Status
export type UnifiedReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'seated'
  | 'completed'
  | 'cancelled'
  | 'no_show';

// Order Type
export type UnifiedOrderType = 'dine_in' | 'takeaway' | 'delivery';

// ============================================================================
// COMMON TYPES
// ============================================================================

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Address {
  street?: string;
  village?: string;
  district?: string;
  province?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  coordinates?: Coordinates;
  fullAddress?: string;
}

export interface ContactInfo {
  phone?: string;
  email?: string;
  whatsapp?: string;
}

export interface Translations {
  en?: { name: string; description?: string };
  lo?: { name: string; description?: string };
  zh?: { name: string; description?: string };
  th?: { name: string; description?: string };
  ko?: { name: string; description?: string };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  skip?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface Money {
  amount: number;
  currency: string;
}

// ============================================================================
// RESTAURANT TYPES
// ============================================================================

export interface DayHours {
  day: number; // 0 = Sunday, 1 = Monday, etc.
  dayName: string;
  isOpen: boolean;
  shifts: Array<{
    open: string; // HH:mm
    close: string; // HH:mm
  }>;
}

export interface RestaurantFeatures {
  dineIn: boolean;
  takeaway: boolean;
  delivery: boolean;
  reservation: boolean;
  qrOrdering: boolean;
  liveBill: boolean;
  splitBill: boolean;
  loyaltyPoints: boolean;
}

export interface RestaurantRating {
  average: number;
  count: number;
}

export interface CurrencySettings {
  main: string;
  supported: string[];
  exchangeRates?: Record<string, number>;
}

export interface UnifiedRestaurant {
  // Identification
  id: string;                      // Prefixed: v1_xxx or v2_xxx
  posVersion: POSVersion;
  originalId: string;              // Original POS ID
  
  // Basic Info
  name: string;
  description?: string;
  translations?: Translations;
  
  // Images
  image?: string;
  logo?: string;
  coverImage?: string;
  images?: string[];
  
  // Location
  address: Address;
  
  // Contact
  contact?: ContactInfo;
  
  // Rating
  rating?: RestaurantRating;
  
  // Features
  features: RestaurantFeatures;
  
  // Business Hours
  businessHours: DayHours[];
  
  // Currency
  currency: CurrencySettings;
  
  // Tax & Service
  taxRate?: number;
  serviceChargeRate?: number;
  
  // Status
  isOpen: boolean;
  isActive: boolean;
  
  // Metadata
  createdAt?: Date;
  updatedAt?: Date;
  
  // Original POS data (for debugging/fallback)
  _posData?: any;
}

// ============================================================================
// MENU TYPES
// ============================================================================

export interface MenuItemOption {
  id: string;
  name: string;
  price: number;
  isRequired?: boolean;
  maxSelections?: number;
  choices?: Array<{
    id: string;
    name: string;
    price: number;
    isDefault?: boolean;
  }>;
}

export interface MenuItemVariant {
  id: string;
  name: string;
  price: number;
  sku?: string;
}

export interface UnifiedMenuItem {
  // Identification
  id: string;
  posVersion: POSVersion;
  originalId: string;
  
  // Basic Info
  name: string;
  description?: string;
  translations?: Translations;
  
  // Category
  categoryId: string;
  categoryName?: string;
  
  // Pricing
  price: number;
  originalPrice?: number;
  currency: string;
  multiCurrencyPrices?: Money[];
  
  // Images
  image?: string;
  images?: string[];
  
  // Options & Variants
  options?: MenuItemOption[];
  variants?: MenuItemVariant[];
  
  // Inventory
  isAvailable: boolean;
  quantity?: number;
  trackInventory?: boolean;
  
  // Metadata
  sku?: string;
  barcode?: string;
  sortOrder?: number;
  
  // Display
  isActive: boolean;
  isShowOnApp: boolean;
  
  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
  
  // Original POS data
  _posData?: any;
}

export interface UnifiedCategory {
  id: string;
  posVersion: POSVersion;
  originalId: string;
  name: string;
  description?: string;
  translations?: Translations;
  image?: string;
  sortOrder?: number;
  isActive: boolean;
  itemCount?: number;
}

export interface UnifiedMenu {
  restaurantId: string;
  posVersion: POSVersion;
  categories: UnifiedCategory[];
  items: UnifiedMenuItem[];
}

// ============================================================================
// ORDER TYPES
// ============================================================================

export interface OrderItemModifier {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface UnifiedOrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  currency: string;
  
  // Modifiers/Options
  modifiers?: OrderItemModifier[];
  note?: string;
  
  // Status
  status?: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
  
  // Original data
  _posData?: any;
}

export interface OrderPricing {
  subtotal: number;
  discount: number;
  discountType?: 'percent' | 'amount';
  discountReason?: string;
  tax: number;
  taxRate?: number;
  serviceCharge: number;
  serviceChargeRate?: number;
  total: number;
  currency: string;
}

export interface PaymentSplit {
  id: string;
  userId?: string;
  name?: string;
  amount: number;
  status: 'pending' | 'paid' | 'failed';
  paymentMethod?: string;
  paidAt?: Date;
}

export interface OrderPayment {
  status: UnifiedPaymentStatus;
  method?: string;
  methods?: string[];
  totalDue: number;
  paidAmount: number;
  change?: number;
  tip?: number;
  transactionIds?: string[];
  splits?: PaymentSplit[];
}

export interface OrderTiming {
  orderedAt: Date;
  confirmedAt?: Date;
  preparingAt?: Date;
  readyAt?: Date;
  servedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  pickupTime?: Date;        // For Order Ahead
  estimatedReadyTime?: Date;
}

export interface OrderTable {
  id: string;
  name: string;
  zone?: string;
}

export interface OrderCustomer {
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
}

export interface UnifiedOrder {
  // Identification
  id: string;                      // Prefixed: v1_xxx or v2_xxx
  posVersion: POSVersion;
  originalId: string;
  orderCode: string;               // Human-readable code (queue number)
  
  // Restaurant
  restaurantId: string;
  restaurantName?: string;
  branchId?: string;
  
  // Type & Status
  orderType: UnifiedOrderType;
  status: UnifiedOrderStatus;
  
  // Customer
  customer?: OrderCustomer;
  
  // Table (for dine-in)
  table?: OrderTable;
  
  // Items
  items: UnifiedOrderItem[];
  
  // Pricing
  pricing: OrderPricing;
  
  // Payment
  payment: OrderPayment;
  
  // Timing
  timing: OrderTiming;
  
  // Notes
  note?: string;
  kitchenNote?: string;
  
  // Source
  source?: 'app' | 'pos' | 'qr' | 'web';
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  
  // Original POS data
  _posData?: any;
}

// ============================================================================
// TABLE & RESERVATION TYPES
// ============================================================================

export type TableStatus =
  | 'available'
  | 'occupied'
  | 'reserved'
  | 'dirty'
  | 'maintenance';

export interface UnifiedTable {
  id: string;
  posVersion: POSVersion;
  originalId: string;
  restaurantId: string;
  
  name: string;
  zone?: string;
  zoneName?: string;
  
  capacity: number;
  minCapacity?: number;
  maxCapacity?: number;
  
  status: TableStatus;
  currentSessionId?: string;
  currentReservationId?: string;
  
  // Layout (for floor plan)
  position?: { x: number; y: number };
  shape?: 'square' | 'rectangle' | 'circle';
  
  isActive: boolean;
  
  _posData?: any;
}

export interface TimeSlot {
  time: string;              // HH:mm
  available: boolean;
  tables: string[];          // Available table IDs
  maxPartySize?: number;
  waitTime?: number;         // Minutes if not immediately available
}

export interface UnifiedReservation {
  // Identification
  id: string;
  posVersion: POSVersion;
  originalId: string;
  reservationCode?: string;
  
  // Restaurant
  restaurantId: string;
  restaurantName?: string;
  branchId?: string;
  
  // Table(s)
  tableId?: string;
  tableIds?: string[];
  tableName?: string;
  zone?: string;
  
  // Timing
  date: string;              // YYYY-MM-DD
  time: string;              // HH:mm
  endTime?: string;          // HH:mm
  duration?: number;         // Minutes
  
  // Guest Info
  guestCount: number;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  
  // Status
  status: UnifiedReservationStatus;
  
  // Deposit
  deposit?: {
    required: boolean;
    amount: number;
    paid: boolean;
    paymentId?: string;
  };
  
  // Notes
  note?: string;
  specialRequests?: string;
  
  // Source
  source?: 'app' | 'phone' | 'walk_in' | 'web';
  
  // Metadata
  createdAt: Date;
  updatedAt?: Date;
  confirmedAt?: Date;
  cancelledAt?: Date;
  
  _posData?: any;
}

// ============================================================================
// BILL TYPES
// ============================================================================

export interface UnifiedBill {
  id: string;
  posVersion: POSVersion;
  originalId: string;
  
  restaurantId: string;
  tableId?: string;
  tableName?: string;
  
  orders: string[];          // Order IDs
  
  pricing: OrderPricing;
  payment: OrderPayment;
  
  status: 'open' | 'checkout_requested' | 'paid' | 'cancelled';
  
  customer?: OrderCustomer;
  
  createdAt: Date;
  updatedAt: Date;
  paidAt?: Date;
  
  _posData?: any;
}

// ============================================================================
// INPUT TYPES (for creating/updating)
// ============================================================================

export interface CreateOrderInput {
  restaurantId: string;
  orderType: UnifiedOrderType;
  
  items: Array<{
    menuItemId: string;
    quantity: number;
    modifiers?: Array<{
      id: string;
      quantity?: number;
    }>;
    note?: string;
  }>;
  
  // For dine-in
  tableId?: string;
  
  // Customer info
  customer?: {
    id?: string;
    name?: string;
    phone?: string;
  };
  
  // Scheduling (Order Ahead)
  scheduling?: {
    type: 'asap' | 'scheduled';
    pickupTime?: Date;
  };
  
  // Discounts
  discount?: {
    type: 'percent' | 'amount' | 'loyalty' | 'voucher';
    value: number;
    code?: string;
    reason?: string;
  };
  
  // Loyalty
  pointsToRedeem?: number;
  
  // Notes
  note?: string;
  
  // Source
  source?: 'app' | 'web' | 'qr';
}

export interface CreateReservationInput {
  restaurantId: string;
  
  // Timing
  date: string;              // YYYY-MM-DD
  time: string;              // HH:mm
  duration?: number;         // Minutes
  
  // Guest Info
  guestCount: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  
  // Preferences
  tablePreference?: string;  // Table ID or zone
  specialRequests?: string;
  
  // Source
  source?: 'app' | 'web';
}

export interface AvailabilityParams {
  restaurantId: string;
  date: string;              // YYYY-MM-DD
  partySize: number;
  duration?: number;         // Minutes
}

export interface SplitBillInput {
  billId: string;
  splitType: 'equal' | 'by_amount' | 'by_items';
  participants: Array<{
    userId?: string;
    name?: string;
    amount?: number;         // For by_amount
    items?: string[];        // For by_items (item IDs)
  }>;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface POSHealthStatus {
  isHealthy: boolean;
  latency?: number;          // ms
  lastCheck: Date;
  error?: string;
}

export interface POSConnectionStatus {
  v1: POSHealthStatus;
  v2: POSHealthStatus;
}
