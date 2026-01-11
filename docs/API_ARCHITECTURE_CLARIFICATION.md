# 🚨 API Architecture Clarification

**Date:** January 6, 2026  
**Critical Update:** Mobile App API Connection Rules

---

## ❌ **PROBLEM: Old Architecture (DO NOT USE)**

### **What We DON'T Want:**

```
┌─────────────────────────────────────────┐
│       Mobile App (Flutter/RN)           │
└─────────────────────────────────────────┘
           │                    │
           │ Direct             │ Direct
           ▼                    ▼
┌──────────────────┐   ┌─────────────────────┐
│ auth.lailaolab   │   │ app-api.appzap.la   │
│      .com        │   │      /app           │
│   (GraphQL)      │   │      (REST)         │
└──────────────────┘   └─────────────────────┘

❌ Security Risk
❌ Multiple API Connections
❌ Mixed Protocols (GraphQL + REST)
❌ Hard to Maintain
❌ Cannot Monitor Usage
```

---

## ✅ **SOLUTION: New Architecture (USE THIS)**

### **What We DO Want:**

```
┌─────────────────────────────────────────┐
│       Mobile App (Flutter/RN)           │
└─────────────────────────────────────────┘
              │
              │ ✅ SINGLE CONNECTION (REST)
              ▼
┌─────────────────────────────────────────┐
│    🎯 Consumer API Gateway              │
│    consumer-api.appzap.la               │
│    /api/v1/*                            │
└─────────────────────────────────────────┘
              │
              │ Internal (Hidden)
              ▼
┌─────────────────────────────────────────┐
│    Backend Services                     │
│    - auth.lailaolab.com (OTP SMS)       │
│    - POS API (Restaurants)              │
│    - Supplier API (Market)              │
└─────────────────────────────────────────┘

✅ Single Entry Point
✅ Consistent REST API
✅ Better Security
✅ Easy to Monitor
✅ Flexible Backend
```

---

## 📋 **API ENDPOINT COMPARISON**

### **❌ OLD (Don't Use):**

| Function | Old Endpoint | Status |
|----------|--------------|--------|
| Request OTP | `https://auth.lailaolab.com/graphql` | ❌ DEPRECATED |
| Verify OTP | `https://auth.lailaolab.com/graphql` | ❌ DEPRECATED |
| Get Profile | `https://app-api.appzap.la/app/user/profile` | ❌ DEPRECATED |

### **✅ NEW (Use This):**

| Function | New Endpoint | Status |
|----------|--------------|--------|
| Request OTP | `https://consumer-api.appzap.la/api/v1/auth/request-otp` | ✅ ACTIVE |
| Verify OTP | `https://consumer-api.appzap.la/api/v1/auth/verify-otp` | ✅ ACTIVE |
| Get Profile | `https://consumer-api.appzap.la/api/v1/auth/me` | ✅ ACTIVE |
| Refresh Token | `https://consumer-api.appzap.la/api/v1/auth/refresh` | ✅ ACTIVE |
| Switch Profile | `https://consumer-api.appzap.la/api/v1/auth/switch-profile` | ✅ ACTIVE |

---

## 🔧 **MOBILE APP CONFIGURATION**

### **✅ CORRECT Configuration:**

```typescript
// config/api.config.ts
export const API_CONFIG = {
  baseURL: 'https://consumer-api.appzap.la',  // ✅ Single endpoint
  timeout: 30000,
};

const apiClient = axios.create(API_CONFIG);
```

### **❌ WRONG Configuration:**

```typescript
// ❌ DO NOT DO THIS!
export const API_CONFIG = {
  authAPI: 'https://auth.lailaolab.com',           // ❌ WRONG!
  appAPI: 'https://app-api.appzap.la/app',         // ❌ WRONG!
};

// ❌ Multiple API clients
const authClient = axios.create({ baseURL: authAPI });
const appClient = axios.create({ baseURL: appAPI });
```

---

## 🌐 **WEBVIEW (supply.appzap.la) CONFIGURATION**

### **✅ CORRECT - WebView Also Uses Consumer API:**

```javascript
// supply.appzap.la/src/config/api.js
const apiClient = axios.create({
  baseURL: 'https://consumer-api.appzap.la',  // ✅ Same as mobile app!
});

// Fetch products from Consumer API
async function fetchProducts() {
  const response = await apiClient.get('/api/v1/market/products');
  return response.data;
}
```

### **❌ WRONG - WebView Using Old APIs:**

```javascript
// ❌ DO NOT DO THIS in WebView!
const response = await fetch('https://app-api.appzap.la/app/products');
```

---

## 🔍 **HOW TO VERIFY YOUR IMPLEMENTATION**

### **Checklist for Mobile Team:**

- [ ] Single API base URL: `consumer-api.appzap.la`
- [ ] No direct calls to `auth.lailaolab.com`
- [ ] No direct calls to `app-api.appzap.la`
- [ ] No GraphQL queries in mobile code
- [ ] All auth endpoints use `/api/v1/auth/*`
- [ ] WebView also uses Consumer API
- [ ] Tokens stored securely
- [ ] Token refresh implemented

### **Test Commands:**

```bash
# Search for old API URLs in your codebase
cd your-mobile-app-folder

# Should return ZERO results:
grep -r "auth.lailaolab.com" src/
grep -r "app-api.appzap.la" src/
grep -r "/graphql" src/

# Should return results (good!):
grep -r "consumer-api.appzap.la" src/
grep -r "/api/v1/auth" src/
```

---

## 📝 **CODE EXAMPLES**

### **✅ CORRECT - Login Flow:**

```typescript
// services/auth.service.ts
import apiClient from './apiClient';

// ✅ All calls go to Consumer API
export const authService = {
  async requestOTP(phone: string) {
    const response = await apiClient.post('/api/v1/auth/request-otp', {
      phone: phone,
      platform: 'APPZAP',
      header: 'AppZap'
    });
    return response.data;
  },

  async verifyOTP(phone: string, otp: string) {
    const response = await apiClient.post('/api/v1/auth/verify-otp', {
      phone: phone,
      otp: otp
    });
    
    // Store tokens
    await SecureStore.setItemAsync('accessToken', response.data.accessToken);
    await SecureStore.setItemAsync('refreshToken', response.data.refreshToken);
    
    return response.data;
  },

  async getCurrentUser() {
    const response = await apiClient.get('/api/v1/auth/me');
    return response.data;
  }
};
```

### **❌ WRONG - Old Login Flow:**

```typescript
// ❌ DO NOT DO THIS!
import { GraphQLClient } from 'graphql-request';

const authClient = new GraphQLClient('https://auth.lailaolab.com/graphql');  // ❌ WRONG!

export const authService = {
  async requestOTP(phone: string) {
    const mutation = `
      mutation RequestOtp($input: OtpInput!) {
        requestOtp(data: $input) { success }
      }
    `;
    // ❌ Direct call to Auth API
    const response = await authClient.request(mutation, { input: { phone } });
    return response;
  }
};
```

---

## 📚 **UPDATED DOCUMENTATION**

The following documents have been updated to reflect the new architecture:

1. **`PHASE1_API_DOC.md`** - Main implementation guide
   - ✅ Added TL;DR section with clear rules
   - ✅ Added "API Connection Rules" section
   - ✅ Added correct configuration examples
   - ✅ Added troubleshooting for old API usage
   - ✅ Updated all code examples

2. **`CONSUMER_API_REQUIREMENTS.md`** - Backend requirements
   - ✅ Shows old vs. new architecture comparison
   - ✅ Explains why single API is better

---

## 🚀 **NEXT STEPS FOR MOBILE TEAM**

### **1. Review Configuration (10 minutes):**
- [ ] Read updated `PHASE1_API_DOC.md`
- [ ] Check current mobile app configuration
- [ ] Verify no old API URLs exist

### **2. Update Code (30 minutes):**
- [ ] Create single API client with Consumer API base URL
- [ ] Update all auth service calls to use Consumer API
- [ ] Remove any GraphQL code
- [ ] Remove any direct calls to old APIs

### **3. Test (15 minutes):**
- [ ] Test OTP request
- [ ] Test OTP verification
- [ ] Test profile fetching
- [ ] Test token refresh
- [ ] Test WebView authentication

### **4. Deploy:**
- [ ] Update production config
- [ ] Deploy to TestFlight/Google Play Internal Testing
- [ ] Verify with real users

---

## 📞 **QUESTIONS?**

**If you see these errors:**
- "GraphQL Error" → You're calling old Auth API
- "CORS Error" → You're calling internal API directly
- "404 Not Found" → Check base URL and endpoint path
- "401 Unauthorized" → Token issue, check token storage/refresh

**Contact:**
- API Team: api@appzap.la
- Documentation: See `PHASE1_API_DOC.md`

---

## ✅ **SUMMARY**

| What | Old | New |
|------|-----|-----|
| **Auth API** | auth.lailaolab.com | consumer-api.appzap.la |
| **App API** | app-api.appzap.la/app | consumer-api.appzap.la |
| **Protocol** | GraphQL + REST | REST only |
| **Endpoints** | Multiple | Single |
| **Security** | Direct access | Gateway protected |
| **Monitoring** | Scattered | Centralized |

**🎯 Remember: Mobile app should ONLY talk to Consumer API, nothing else!**

---

**Last Updated:** January 6, 2026  
**Version:** 1.0

