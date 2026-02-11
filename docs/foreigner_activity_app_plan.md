# AppZap: The Essential Activity App for Foreigners in Laos

## Vision Statement
Transform AppZap from a restaurant-focused app into the **#1 Activity App for Foreigners in Laos** - targeting tourists, expats, and business travelers who have more spending power and need a reliable companion to navigate Laos.

---

## Target Audience

### Primary: Foreigners in Laos
- **Tourists** (1-14 days): Need quick discovery, activities, deals
- **Business Travelers** (1-7 days): Need hotels, restaurants, transportation
- **Expats** (long-term): Need local services, events, community

### Secondary: Local Lao Users
- Continue serving existing user base
- Benefit from improved features

---

## Core Value Proposition

**"AppZap = Your Laos Companion"**
- 🍽️ **Food**: Restaurants, cafes, street food
- 🏨 **Stay**: Hotels, guesthouses, hostels
- 🎉 **Do**: Events, tours, activities, nightlife
- 🎫 **Save**: Coupons, deals, promotions
- 📍 **Navigate**: Landmark-based discovery (unique to Laos)

---

## Implementation Phases

### Phase A: Authentication & User System

#### A1: International SMS OTP
- Support phone numbers from 200+ countries
- Auto-detect country from phone prefix
- Cost-optimized routing (local vs international SMS)
- Country picker UI with popular countries

#### A2: Progressive User Profile
- Easy registration: Phone only
- Collect more data when needed (first coupon purchase, hotel booking)
- Profile completeness tracking
- Gamification: "Complete profile for 500 ZapPoints"

### Phase B: Landmark-Based Location System

#### B1: Lao Landmarks Database
Districts: Dongdok, Sihom, Phontan, Chanthabouly, Sisattanak, etc.
Attractions: Patuxay, That Luang, Buddha Park, Morning Market, etc.
Transport: Bus stations, airports, ferry terminals
Malls: Vientiane Center, Parkson, Talat Sao, ITECC

#### B2: Landmark Search Integration
- "What's near Dongdok?"
- Quick landmark picker on home screen
- Map optional (landmark is primary)

### Phase C: Hotels & Accommodation

#### C1: Hotel Discovery
- List hotels by landmark, amenities, price
- Star ratings, reviews, photos
- Contact info (phone, WhatsApp)
- Price range display

#### C2: Hotel Reservations (Future)
- Room availability
- Booking flow
- Payment integration

### Phase D: Activities & Events

#### D1: Activities Database
Categories:
- 🎭 Festivals (Pi Mai, Boat Racing, That Luang)
- 🚐 Tours (City tours, Mekong cruise)
- 🍳 Classes (Cooking, language)
- 🌃 Nightlife (Clubs, bars, live music)
- ⛳ Sports (Golf, bowling, fitness)
- 🌿 Nature (Waterfalls, caves, hiking)
- 🏛️ Cultural (Temples, museums)

#### D2: Event Calendar
- Upcoming events in Laos
- Filter by date, category, landmark
- Save/bookmark events

### Phase E: Advertising System

#### E1: Ad Placements
- Banner ads (home top/bottom)
- Popup ads (app open, once per session)
- Native ads (in-feed)
- Sponsored listings

#### E2: Ad Management
- Admin panel for ad creation
- Targeting (location, user type, nationality)
- Analytics (impressions, clicks, conversions)
- Budget management

### Phase F: Mobile App Updates

#### F1: New Navigation
```
Bottom Navigation:
┌─────────────────────────────────────────────────────┐
│  🏠 Home  │  🔍 Discover  │  📸 Scan  │  🎫 Deals  │  👤 Me  │
└─────────────────────────────────────────────────────┘
```

#### F2: Multi-Language Support
- English (default for foreigners)
- Lao (ພາສາລາວ)
- Thai (ภาษาไทย)
- Chinese (中文)
- Korean (한국어)
- Japanese (日本語)

---

## Database Models

### User (Updated)
```javascript
{
  phone: "+12025551234",
  phoneCountryCode: "US",
  phoneVerified: true,
  
  // Progressive profile
  fullName: "John Smith",
  nickname: "John",
  dateOfBirth: Date,
  gender: "male",
  nationality: "US",
  preferredLanguage: "en",
  
  // Profile completeness
  profileCompleteness: 75,
  missingFields: ["dateOfBirth"],
  
  // Existing fields...
}
```

### Landmark
```javascript
{
  name: "Dongdok",
  nameLocal: "ດົງໂດກ",
  type: "district",
  location: { type: "Point", coordinates: [102.xx, 17.xx] },
  radius: 2000,
  province: "Vientiane Capital",
  isPopular: true,
  searchKeywords: ["dongdok", "dong dok"]
}
```

### Hotel
```javascript
{
  name: "Landmark Mekong Hotel",
  landmark: ObjectId,
  starRating: 4,
  hotelType: "hotel",
  amenities: ["wifi", "pool", "breakfast"],
  priceRange: { min: 50, max: 150, currency: "USD" },
  isFeatured: true
}
```

### Activity
```javascript
{
  title: "Boun Pi Mai Festival",
  category: "festival",
  landmark: ObjectId,
  eventType: "one_time",
  schedule: { startDate: Date, endDate: Date },
  isFree: false,
  price: { amount: 0, currency: "LAK" }
}
```

### Advertisement
```javascript
{
  type: "banner",
  placement: "home_top",
  content: { imageUrl, title, ctaUrl },
  targeting: { provinces: [], nationalities: [] },
  startDate: Date,
  endDate: Date,
  impressions: 0,
  clicks: 0
}
```

---

## API Endpoints Summary

### Authentication
- `POST /auth/request-otp` - Send OTP (international)
- `POST /auth/verify-otp` - Verify OTP
- `GET /auth/supported-countries` - List supported countries

### Users
- `GET /users/me/profile-status` - Profile completeness
- `PUT /users/me/profile` - Update profile
- `GET /users/me/required-fields?action=buy_coupon` - Required fields

### Landmarks
- `GET /landmarks` - List landmarks
- `GET /landmarks/popular` - Popular landmarks
- `GET /landmarks/search?q=dong` - Search
- `GET /landmarks/:id/nearby` - Nearby places

### Hotels
- `GET /hotels` - List hotels
- `GET /hotels/featured` - Featured hotels
- `GET /hotels/:id` - Hotel details

### Activities
- `GET /activities` - List activities
- `GET /activities/upcoming` - Upcoming events
- `GET /activities/categories` - Categories
- `GET /activities/:id` - Activity details

### Advertisements
- `GET /ads?placement=home_top` - Get ads
- `POST /ads/:id/impression` - Track impression
- `POST /ads/:id/click` - Track click

---

## Revenue Streams

1. **Coupon Sales**: 10-30% commission per coupon sold
2. **Hotel Bookings**: 10-15% commission per booking
3. **Premium Listings**: Restaurants/Hotels pay for featured placement
4. **Advertising**: Banner, popup, native ads
5. **Event Tickets**: Commission on event bookings
6. **Subscription**: Premium user features (ad-free, exclusive deals)

---

## Success Metrics

- **Downloads**: Target 50,000 in 6 months
- **MAU**: Monthly Active Users > 20,000
- **Foreigner Ratio**: > 40% of users are foreigners
- **Coupon Sales**: $10,000/month GMV
- **Ad Revenue**: $2,000/month

---

## Implementation Status ✅

### Backend (Node.js/MongoDB) - COMPLETED

| Component | Status | Files |
|-----------|--------|-------|
| User Model (International) | ✅ | `src/models/User.ts` |
| Landmark Model | ✅ | `src/models/Landmark.ts` |
| Hotel Model | ✅ | `src/models/Hotel.ts` |
| Activity Model | ✅ | `src/models/Activity.ts` |
| Advertisement Model | ✅ | `src/models/Advertisement.ts` |
| Landmark Service | ✅ | `src/services/landmark.service.ts` |
| Hotel Service | ✅ | `src/services/hotel.service.ts` |
| Activity Service | ✅ | `src/services/activity.service.ts` |
| Advertisement Service | ✅ | `src/services/advertisement.service.ts` |
| Landmark Routes | ✅ | `src/routes/landmark.routes.ts` |
| Hotel Routes | ✅ | `src/routes/hotel.routes.ts` |
| Activity Routes | ✅ | `src/routes/activity.routes.ts` |
| Advertisement Routes | ✅ | `src/routes/advertisement.routes.ts` |
| Landmarks Seed Data | ✅ | `src/seeds/landmarks.seed.ts` |
| App.ts Updated | ✅ | Routes registered |

### Mobile App (Flutter) - COMPLETED

| Component | Status | Files |
|-----------|--------|-------|
| Landmark Models | ✅ | `lib/core/api/models/landmark_models.dart` |
| Hotel Models | ✅ | `lib/core/api/models/hotel_models.dart` |
| Activity Models | ✅ | `lib/core/api/models/activity_models.dart` |
| Advertisement Models | ✅ | `lib/core/api/models/advertisement_models.dart` |
| Models Barrel Export | ✅ | `lib/core/api/models/models.dart` |
| Landmark Repository | ✅ | `lib/core/api/repositories/landmark_repository.dart` |
| Hotel Repository | ✅ | `lib/core/api/repositories/hotel_repository.dart` |
| Activity Repository | ✅ | `lib/core/api/repositories/activity_repository.dart` |
| Advertisement Repository | ✅ | `lib/core/api/repositories/advertisement_repository.dart` |
| Repositories Barrel Export | ✅ | `lib/core/api/repositories/repositories.dart` |
| API Config (New Endpoints) | ✅ | `lib/core/api/api_config.dart` |
| Explore Page (Tabbed) | ✅ | `lib/features/discover/presentation/pages/explore_page.dart` |
| Ad Banner Widget | ✅ | `lib/shared/widgets/ad_banner_widget.dart` |
| Country Picker (Expanded) | ✅ | `lib/shared/widgets/country_picker.dart` (40+ countries) |
| Country Model (Expanded) | ✅ | `lib/shared/models/country.dart` (40+ countries) |
| Language Picker | ✅ | `lib/shared/widgets/language_picker.dart` |
| Locale Provider | ✅ | `lib/l10n/locale_provider.dart` |
| i18n - English | ✅ | `lib/l10n/app_en.arb` |
| i18n - Lao | ✅ | `lib/l10n/app_lo.arb` |
| i18n - Thai | ✅ | `lib/l10n/app_th.arb` |
| i18n - Chinese | ✅ | `lib/l10n/app_zh.arb` |
| i18n - Korean | ✅ | `lib/l10n/app_ko.arb` |
| i18n - Japanese | ✅ | `lib/l10n/app_ja.arb` |

---

## Integration Steps - COMPLETED ✅

### Mobile App Integration (All Complete)

| Step | Status | Description |
|------|--------|-------------|
| 1. Run `flutter gen-l10n` | ✅ | Generated localization files in `lib/l10n/generated/` |
| 2. Update `main.dart` | ✅ | Added `LocaleProvider`, `AppLocalizations` delegates |
| 3. Update navigation | ✅ | New bottom nav: Home \| Discover \| [Scan] \| Deals \| Me |
| 4. Add Ad Banners | ✅ | `AdBannerWidget` in Home page (top & middle) |
| 5. Add Language Picker | ✅ | `LanguagePicker` in Account/Me settings |

### Files Updated for Integration

| File | Changes |
|------|---------|
| `lib/main.dart` | Added `LocaleProvider`, `AppLocalizations` support |
| `lib/app/app.dart` | Added localization delegates |
| `lib/app/main_shell.dart` | New navigation: Home, Discover, Deals, Me tabs |
| `lib/features/home/presentation/pages/home_tab_page.dart` | Added Ad banners |
| `lib/features/deals/presentation/pages/deals_page.dart` | NEW - Deals page with categories |
| `lib/features/account/presentation/pages/account_page.dart` | Added Language picker |
| `lib/shared/widgets/language_picker.dart` | Enhanced with standalone mode |
| `lib/l10n/generated/*.dart` | Generated localization classes |
| `l10n.yaml` | Removed deprecated `synthetic-package` |

---

## API Endpoints Summary

### Landmarks
- `GET /api/v1/landmarks` - List landmarks
- `GET /api/v1/landmarks/popular` - Popular landmarks
- `GET /api/v1/landmarks/search?q=` - Search landmarks
- `GET /api/v1/landmarks/types` - Get types with counts
- `GET /api/v1/landmarks/provinces` - Get provinces
- `GET /api/v1/landmarks/nearby?lat=&lng=` - Nearby landmarks
- `GET /api/v1/landmarks/:id` - Landmark details

### Hotels
- `GET /api/v1/hotels` - List hotels
- `GET /api/v1/hotels/featured` - Featured hotels
- `GET /api/v1/hotels/search?q=` - Search hotels
- `GET /api/v1/hotels/types` - Get hotel types
- `GET /api/v1/hotels/amenities` - Get amenities
- `GET /api/v1/hotels/near-landmark/:id` - Hotels near landmark
- `GET /api/v1/hotels/:id` - Hotel details
- `POST /api/v1/hotels/:id/inquiry` - Track inquiry

### Activities
- `GET /api/v1/activities` - List activities
- `GET /api/v1/activities/upcoming` - Upcoming events
- `GET /api/v1/activities/featured` - Featured activities
- `GET /api/v1/activities/search?q=` - Search activities
- `GET /api/v1/activities/categories` - Get categories
- `GET /api/v1/activities/near-landmark/:id` - Activities near landmark
- `GET /api/v1/activities/:id` - Activity details
- `POST /api/v1/activities/:id/save` - Save/bookmark

### Advertisements
- `GET /api/v1/ads?placement=` - Get ads for placement
- `POST /api/v1/ads/:id/impression` - Track impression
- `POST /api/v1/ads/:id/click` - Track click
- `POST /api/v1/ads/:id/conversion` - Track conversion

### Admin Endpoints (Protected)
- All CRUD operations for landmarks, hotels, activities
- Ad management (create, approve, reject, pause)
- Revenue analytics
