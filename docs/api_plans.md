# AppZap Consumer API V2 - Feature Roadmap & Implementation Plan

## Executive Summary

This document outlines the strategic rollout of Consumer API V2 features, organized into phases designed to:
1. **Maximize app downloads** from existing web ordering users
2. **Create viral growth** through social features
3. **Build retention** through loyalty and engagement
4. **Expand ecosystem** with additional services

---

## The Core Strategy: Web-to-App Conversion

### The Opportunity

AppZap already has **thousands of users** ordering via web/mobile browser at restaurants using:
- POS V1 (appzap-app-api) - QR code ordering
- POS V2 (appzap-pos-api-v2) - Self-ordering system

These users are **already engaged** - they're actively ordering food. Converting them to mobile app users is:
- **Easier** than acquiring cold users
- **Higher intent** - they already trust the brand
- **Seamless** - their order history carries over

### The Hook

When a user completes a web order, they see:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│    🎉 Your order is confirmed!                                  │
│                                                                  │
│    Order #A1B2C3 - ₭125,000                                     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🎰 SPIN TO WIN FREE REWARDS!                           │   │
│  │                                                          │   │
│  │  Download the AppZap app and spin the wheel to win:     │   │
│  │                                                          │   │
│  │  🍺 FREE Beer on your next order                        │   │
│  │  💰 Up to 20,000 LAK discount                           │   │
│  │  🎁 Bonus loyalty points (200-500)                      │   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │  📱 Download App & Spin Now!                     │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  │                                                          │   │
│  │  Your spin expires in 30 days                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ✅ Your order will also appear in the app automatically!      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Web-to-App Conversion (Launch Priority)

### 1.1 Goal
Convert existing web ordering users to mobile app users through:
- **Gamification** (Spin-to-Win rewards)
- **Incentives** (Discounts, free items)
- **Seamless continuity** (Orders sync to app)

### 1.2 User Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        WEB-TO-APP CONVERSION FLOW                            │
└─────────────────────────────────────────────────────────────────────────────┘

STEP 1: User at Restaurant (Web Ordering)
─────────────────────────────────────────
    User scans QR code → Opens web ordering → Places order → Pays

STEP 2: Order Confirmation (The Hook)
─────────────────────────────────────────
    Order confirmed → Show "Spin to Win" banner → Deep link generated
    
    Deep link contains:
    - Order ID (for order sync)
    - User phone (for account linking)
    - Reward ID (for spin game)
    - Restaurant ID (for context)

STEP 3: App Download
─────────────────────────────────────────
    User clicks "Download App" → App Store / Play Store → Installs app

STEP 4: App Open (Magic Moment)
─────────────────────────────────────────
    User opens app with deep link → Auto-login (same phone) → See recent order
    
    User sees:
    ✅ "Welcome! We found your order from [Restaurant Name]"
    ✅ Order details and status
    ✅ "You have 1 FREE SPIN! Tap to play"

STEP 5: Engagement
─────────────────────────────────────────
    User spins → Wins reward → Saves to wallet → Returns to use it
```

### 1.3 Technical Implementation

#### 1.3.1 Deep Link Structure

```
Base URL: https://app.appzap.la/links/{shortCode}

Deep Link Data:
{
  "targetType": "order",
  "targetId": "order_12345",
  "metadata": {
    "phone": "8562055551234",
    "restaurantId": "v1_abc123",
    "restaurantName": "Coffee Shop",
    "orderAmount": 125000,
    "rewardId": "reward_xyz789",
    "source": "web_ordering",
    "posVersion": "v1"
  }
}

App URL Scheme: appzap://order/{orderId}?reward={rewardId}&phone={phone}
```

#### 1.3.2 Consumer API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `POST /api/v1/deep-links` | Create deep link after web order |
| `GET /links/:shortCode` | Handle web redirect to app/store |
| `POST /api/v1/deep-links/:shortCode/track-open` | Track when user opens app |
| `POST /api/v1/deep-links/spin-to-win/:rewardId/spin` | Execute spin game |
| `GET /api/v1/eats/orders` | Get user's orders (including web orders) |

#### 1.3.3 Order Sync Implementation

**How Web Orders Appear in Mobile App:**

1. **Web Order Created (POS V1/V2)**
   - Order stored in POS database
   - Contains user's phone number
   
2. **User Downloads App & Logs In**
   - User enters same phone number
   - OTP verification
   
3. **App Fetches Orders**
   - Calls `GET /api/v1/eats/orders`
   - Consumer API queries both POS V1 and V2
   - Returns unified order list
   
4. **User Sees Their Web Order**
   - Order appears with status
   - Can track order progress
   - Receives push notifications

```typescript
// How order sync works in Consumer API V2
// File: src/adapters/pos.router.ts

async getUserOrders(params: { phone: string }): Promise<UnifiedOrder[]> {
  // Fetch from both POS systems in parallel
  const [v1Orders, v2Orders] = await Promise.allSettled([
    this.v1Adapter.getUserOrders(params),  // Get V1 web orders
    this.v2Adapter.getUserOrders(params),  // Get V2 web orders
  ]);
  
  // Combine and sort by date
  const allOrders = [...v1Orders, ...v2Orders];
  return allOrders.sort((a, b) => b.createdAt - a.createdAt);
}
```

### 1.4 Web Ordering Integration Guide

#### For POS V1 (appzap-app-api) Web Ordering

**Step 1: After Order Completion, Call Consumer API**

```javascript
// In your web ordering confirmation page
const createDownloadIncentive = async (orderData) => {
  // 1. Create deep link with order context
  const response = await fetch('https://api.appzap.la/api/v1/deep-links', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_API_KEY'
    },
    body: JSON.stringify({
      targetType: 'order',
      targetId: orderData.orderId,
      campaignName: 'web_to_app_conversion',
      source: 'web_ordering',
      medium: 'qr_code',
      metadata: {
        phone: orderData.customerPhone,
        restaurantId: `v1_${orderData.storeId}`,
        restaurantName: orderData.storeName,
        orderAmount: orderData.totalAmount,
        posVersion: 'v1'
      },
      expiresInDays: 30
    })
  });
  
  const { deepLink } = await response.json();
  
  return {
    shortCode: deepLink.shortCode,
    shortUrl: deepLink.shortUrl,
    firebaseDynamicLink: deepLink.firebaseDynamicLink,
    rewardId: deepLink.metadata.rewardId
  };
};
```

**Step 2: Display Download Banner**

```html
<!-- Order confirmation page -->
<div class="order-confirmed">
  <h1>✅ Order Confirmed!</h1>
  <p>Order #{{ orderCode }} - ₭{{ totalAmount | number }}</p>
  
  <!-- App Download Banner -->
  <div class="app-download-banner">
    <div class="spin-icon">🎰</div>
    <h2>Spin to Win FREE Rewards!</h2>
    <p>Download the AppZap app and win prizes!</p>
    
    <ul class="prize-list">
      <li>🍺 FREE Beer on your next order</li>
      <li>💰 Up to 20,000 LAK discount</li>
      <li>🎁 Bonus loyalty points</li>
    </ul>
    
    <a href="{{ deepLink.firebaseDynamicLink }}" class="download-btn">
      📱 Download App & Spin Now!
    </a>
    
    <p class="bonus-message">
      ✅ Your order will appear in the app automatically!
    </p>
    
    <p class="expiry">Your spin expires in 30 days</p>
  </div>
</div>
```

**Step 3: Handle App Not Installed (Fallback)**

```javascript
// Firebase Dynamic Link handles this automatically, but for custom implementation:
const openAppOrStore = (deepLink) => {
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  
  // Try to open app first
  const appUrl = `appzap://order/${deepLink.orderId}?reward=${deepLink.rewardId}`;
  
  // Set timeout to redirect to store if app doesn't open
  const timeout = setTimeout(() => {
    if (isAndroid) {
      window.location.href = 'https://play.google.com/store/apps/details?id=la.appzap.consumer';
    } else if (isIOS) {
      window.location.href = 'https://apps.apple.com/app/appzap/id1234567890';
    }
  }, 2500);
  
  // Try opening app
  window.location.href = appUrl;
  
  // If app opens, clear the timeout
  window.addEventListener('blur', () => clearTimeout(timeout));
};
```

#### For POS V2 (appzap-pos-api-v2) Web Ordering

**Same implementation as V1, but with V2 identifiers:**

```javascript
const createDownloadIncentive = async (orderData) => {
  const response = await fetch('https://api.appzap.la/api/v1/deep-links', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_API_KEY'
    },
    body: JSON.stringify({
      targetType: 'order',
      targetId: orderData.orderId,
      campaignName: 'web_to_app_conversion',
      source: 'web_ordering',
      medium: 'qr_code',
      metadata: {
        phone: orderData.customerPhone,
        restaurantId: `v2_${orderData.restaurantId}`,  // Note: v2_ prefix
        restaurantName: orderData.restaurantName,
        orderAmount: orderData.totalAmount,
        posVersion: 'v2'
      },
      expiresInDays: 30
    })
  });
  
  return response.json();
};
```

### 1.5 Mobile App Implementation Guide

#### Handling Deep Link on App Open

```dart
// Flutter example - handling deep link
class DeepLinkHandler {
  void handleDeepLink(Uri uri) async {
    if (uri.pathSegments.contains('order')) {
      final orderId = uri.pathSegments.last;
      final rewardId = uri.queryParameters['reward'];
      final phone = uri.queryParameters['phone'];
      
      // 1. Auto-login if phone provided
      if (phone != null) {
        await authService.loginWithPhone(phone);
      }
      
      // 2. Navigate to order details
      Navigator.pushNamed(context, '/order/$orderId');
      
      // 3. Show spin-to-win dialog if reward exists
      if (rewardId != null) {
        showSpinToWinDialog(rewardId);
      }
    }
  }
  
  void showSpinToWinDialog(String rewardId) {
    showDialog(
      context: context,
      builder: (context) => SpinToWinDialog(
        rewardId: rewardId,
        onSpinComplete: (prize) {
          // Show congratulations and save to wallet
        },
      ),
    );
  }
}
```

#### Welcome Screen for New Users from Web

```dart
// Show welcome message when user's first order is from web
class WelcomeScreen extends StatelessWidget {
  final Order webOrder;
  
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(Icons.check_circle, color: Colors.green, size: 80),
        Text('Welcome to AppZap!'),
        Text('We found your order from ${webOrder.restaurantName}'),
        
        OrderCard(order: webOrder),
        
        if (hasSpinReward)
          SpinToWinButton(
            onTap: () => showSpinDialog(),
          ),
        
        Text('From now on, all your orders will appear here!'),
        
        ElevatedButton(
          onPressed: () => Navigator.pushNamed(context, '/home'),
          child: Text('Start Exploring'),
        ),
      ],
    );
  }
}
```

### 1.6 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Banner Click Rate | 15%+ | Clicks on "Download App" / Order confirmations |
| App Install Rate | 40%+ | Installs / Banner clicks |
| Login Completion | 80%+ | Users who complete login / Installs |
| Spin Completion | 95%+ | Users who spin / Users who login |
| Day 7 Retention | 30%+ | Users active after 7 days / Installs |

### 1.7 A/B Testing Ideas

| Test | Variant A | Variant B |
|------|-----------|-----------|
| Banner Position | After order confirmation | During checkout |
| Incentive Type | Spin-to-win | Direct discount code |
| Message | "Win FREE beer!" | "Get 10% off next order" |
| Urgency | "Expires in 30 days" | "Limited time offer!" |

---

## Phase 2: Viral Growth (Week 2-4)

### 2.1 Features

| Feature | Viral Mechanism | Implementation Status |
|---------|-----------------|----------------------|
| **Spin-to-Win** | User wins → Posts on social media | ✅ Ready |
| **Social Gifting** | Send gift → Friend must download app | ✅ Ready |
| **Bill Splitting** | Split bill → Friends need app | ✅ Ready |
| **Reviews** | Write review → Share on social | ✅ Ready |
| **Deep Links** | Share restaurant/order links | ✅ Ready |

### 2.2 Viral Loop: Spin-to-Win

```
User Orders → Gets Spin Reward → Wins Prize → Posts on Facebook
     ↑                                              ↓
     └──────── Friends see post → Download app ←───┘
```

**API Endpoints:**
- `POST /api/v1/deep-links/spin-to-win/:rewardId/spin`
- `GET /api/v1/deep-links/spin-to-win/rewards`
- `POST /api/v1/deep-links/spin-to-win/:rewardId/redeem`

### 2.3 Viral Loop: Social Gifting

```
User A buys gift → Sends via WhatsApp → Friend B receives
     ↑                                         ↓
     │         Friend B MUST download app to claim
     └──────── Friend B becomes user → Buys gift for C ←───┘
```

**API Endpoints:**
- `GET /api/v1/gifts/templates`
- `POST /api/v1/gifts`
- `POST /api/v1/gifts/:giftId/share`
- `POST /api/v1/gifts/claim`
- `POST /api/v1/gifts/redeem`

### 2.4 Viral Loop: Bill Splitting

```
User at restaurant → Creates split session → Shares code
     ↑                                           ↓
     │         3 friends at table need app to join & pay
     └──────── Each friend becomes active user ←─────────┘
```

**API Endpoints:**
- `POST /api/v1/bill-split`
- `POST /api/v1/bill-split/join`
- `POST /api/v1/bill-split/:sessionId/calculate`
- `POST /api/v1/bill-split/:sessionId/pay`

### 2.5 Marketing Campaigns

| Campaign | Message | Target |
|----------|---------|--------|
| Spin-to-Win | "Order food → Spin to win FREE beer! 🍺🎰" | All users |
| Gifting | "Send a digital coffee to a friend ☕💝" | Special occasions |
| Bill Split | "Split the bill in seconds! No more awkward math 💸" | Group diners |

---

## Phase 3: Retention (Week 4-8)

### 3.1 Features

| Feature | Retention Mechanism | Implementation Status |
|---------|---------------------|----------------------|
| **Loyalty (ZapPoints)** | Earn points → Come back to redeem | ✅ Ready |
| **Table Reservations** | Book table → Return for reservation | ✅ Ready |
| **Push Notifications** | Remind about points, promos | ✅ Ready |
| **Order History** | Re-order favorites easily | ✅ Ready |

### 3.2 Loyalty Program Details

**Earning Points:**
| Action | Points |
|--------|--------|
| Order (per 1,000 LAK) | 1 point |
| Write review | 3,000 points |
| Refer friend | 500 points |
| Claim gift | 100 points |

**Redeeming Points:**
- 10 points = 500 LAK discount
- Points expire after 1 year

**Tiers:**
| Tier | Points Required | Benefits |
|------|-----------------|----------|
| Bronze | 0 | Base earning |
| Silver | 2,000 | 1.5x earning |
| Gold | 5,000 | 2x earning |
| Platinum | 10,000 | 3x earning + priority |

### 3.3 Push Notification Strategy

| Trigger | Message | Timing |
|---------|---------|--------|
| Points milestone | "You're 50 points from free coffee! ☕" | Real-time |
| Reservation reminder | "Your table at [Restaurant] is in 2 hours" | 2 hours before |
| Spin reward expiring | "Your FREE spin expires tomorrow! 🎰" | 1 day before |
| Re-engagement | "We miss you! Here's 20% off your next order" | 7 days inactive |

---

## Phase 4: Ecosystem Expansion (Month 2-3+)

### 4.1 Features

| Feature | Value Proposition | Implementation Status |
|---------|-------------------|----------------------|
| **Market (B2C)** | Order groceries, products | ✅ Ready |
| **Market Subscriptions** | Recurring product orders | ✅ Ready |
| **Live (Health)** | Meal plans, supplements | ✅ Ready |
| **B2B Identity** | Restaurant owners use same app | ✅ Ready |

### 4.2 Expansion Strategy

1. **Month 2:** Launch Market for grocery delivery
2. **Month 3:** Launch subscription services
3. **Month 4:** Launch health & wellness features

---

## Deep Link Implementation Reference

### URL Schemes

| Platform | Scheme |
|----------|--------|
| iOS/Android App | `appzap://` |
| Web Fallback | `https://app.appzap.la/` |
| Firebase Dynamic | `https://appzap.page.link/` |

### Deep Link Types

| Type | URL Pattern | Purpose |
|------|-------------|---------|
| Order | `appzap://order/{orderId}` | View order details |
| Restaurant | `appzap://restaurant/{restaurantId}` | Open restaurant page |
| Gift | `appzap://gift/{giftCode}` | Claim gift |
| Bill Split | `appzap://split/{sessionCode}` | Join split session |
| Reward | `appzap://reward/{rewardId}` | Open spin-to-win |

### Firebase Dynamic Link Configuration

```javascript
const createDynamicLink = {
  domainUriPrefix: 'https://appzap.page.link',
  link: 'https://app.appzap.la/order/12345?reward=xyz',
  androidInfo: {
    androidPackageName: 'la.appzap.consumer',
    androidFallbackLink: 'https://play.google.com/store/apps/details?id=la.appzap.consumer',
    androidMinPackageVersionCode: '1'
  },
  iosInfo: {
    iosBundleId: 'la.appzap.consumer',
    iosFallbackLink: 'https://apps.apple.com/app/appzap/id1234567890',
    iosAppStoreId: '1234567890'
  },
  socialMetaTagInfo: {
    socialTitle: '🎉 You won a reward from AppZap!',
    socialDescription: 'Download the app to claim your prize',
    socialImageLink: 'https://appzap.la/images/share-reward.png'
  }
};
```

---

## API Endpoints Summary by Phase

### Phase 1: Core (Launch)
```
POST /api/v1/auth/request-otp
POST /api/v1/auth/verify-otp
GET  /api/v1/eats/restaurants
GET  /api/v1/eats/restaurants/:id
POST /api/v1/eats/cart
POST /api/v1/eats/cart/:id/checkout
GET  /api/v1/eats/orders
POST /api/v1/deep-links
GET  /links/:shortCode
```

### Phase 2: Viral
```
POST /api/v1/deep-links/spin-to-win/:rewardId/spin
GET  /api/v1/gifts/templates
POST /api/v1/gifts
POST /api/v1/gifts/claim
POST /api/v1/bill-split
POST /api/v1/bill-split/join
POST /api/v1/reviews
```

### Phase 3: Retention
```
GET  /api/v1/loyalty/balance
GET  /api/v1/loyalty/history
POST /api/v1/loyalty/redeem
GET  /api/v1/eats/bookings/availability
POST /api/v1/eats/bookings
POST /api/v1/notifications/fcm-token
```

### Phase 4: Expansion
```
GET  /api/v1/market/products
POST /api/v1/market/checkout
POST /api/v1/market/subscriptions
GET  /api/v1/live/meal-plans
POST /api/v1/live/subscriptions
POST /api/v1/identity/link-supplier
```

---

## Checklist: Web Ordering Integration

### For POS V1 Team
- [ ] Add Consumer API call after order confirmation
- [ ] Display app download banner with deep link
- [ ] Include customer phone in order data
- [ ] Track banner click events
- [ ] Handle deep link fallback to app store

### For POS V2 Team
- [ ] Add Consumer API call after order confirmation
- [ ] Display app download banner with deep link
- [ ] Include customer phone in order data
- [ ] Track banner click events
- [ ] Handle deep link fallback to app store

### For Mobile App Team
- [ ] Handle deep link on app open
- [ ] Auto-login with phone from deep link
- [ ] Show welcome screen with web order
- [ ] Display spin-to-win dialog
- [ ] Fetch and display order history from both POS systems

---

## Expected Results

| Metric | Before | After (3 months) |
|--------|--------|------------------|
| App Downloads | 0 | 50,000+ |
| Weekly Active Users | 0 | 15,000+ |
| Web-to-App Conversion | 0% | 25%+ |
| Viral Coefficient | 0 | 1.5+ |
| Orders via App | 0% | 40%+ |

---

## Conclusion

The key to rapid app adoption is **converting existing web ordering users**:

1. They're already engaged with the brand
2. The transition is seamless (orders sync)
3. Gamification (spin-to-win) creates excitement
4. Viral features bring their friends

**All features are built and ready.** Implementation requires:
1. POS V1/V2 teams to add download banner
2. Mobile app team to handle deep links
3. Marketing team to create campaign assets

---

*Document Version: 1.0*
*Last Updated: February 2026*
*Status: All features implementation complete*
