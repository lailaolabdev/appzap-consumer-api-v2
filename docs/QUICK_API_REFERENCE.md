# ⚡ Quick API Reference - Phase 1
**For Mobile Developers - Copy & Paste Ready**

---

## 🔧 **BASE URL**

```typescript
const API_BASE_URL = 'http://localhost:9000'; // Development
// const API_BASE_URL = 'https://consumer-api.appzap.la'; // Production
```

---

## 🔐 **AUTHENTICATION**

### **1. Request OTP**

```typescript
// POST /api/v1/auth/request-otp
const requestOTP = async (phone: string) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: '8562093352677',
      platform: 'APPZAP',
      header: 'AppZap'
    })
  });
  return await response.json();
};

// Response:
// {
//   "message": "OTP sent successfully",
//   "referenceId": "OTP-2025-001",
//   "expiresIn": 300
// }
```

### **2. Verify OTP & Login**

```typescript
// POST /api/v1/auth/verify-otp
const verifyOTP = async (phone: string, otp: string) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, otp })
  });
  
  const data = await response.json();
  
  // Store tokens
  await SecureStore.setItemAsync('accessToken', data.accessToken);
  await SecureStore.setItemAsync('refreshToken', data.refreshToken);
  
  return data;
};

// Response:
// {
//   "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
//   "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
//   "user": {
//     "id": "6954de226d1a5cfd51039e1c",
//     "phone": "8562093352677",
//     "fullName": null,
//     "roles": ["consumer"],
//     "activeProfile": "personal",
//     "points": { "balance": 0, "tier": "bronze" },
//     "hasCompletedOnboarding": false,
//     "firstLogin": true
//   }
// }
```

### **3. Get Current User**

```typescript
// GET /api/v1/auth/me
const getCurrentUser = async () => {
  const token = await SecureStore.getItemAsync('accessToken');
  
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  return await response.json();
};

// Response: Same user object as login
```

### **4. Refresh Token**

```typescript
// POST /api/v1/auth/refresh
const refreshToken = async () => {
  const refreshToken = await SecureStore.getItemAsync('refreshToken');
  
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });
  
  const data = await response.json();
  
  // Update tokens
  await SecureStore.setItemAsync('accessToken', data.accessToken);
  await SecureStore.setItemAsync('refreshToken', data.refreshToken);
  
  return data;
};
```

### **5. Switch Profile**

```typescript
// POST /api/v1/auth/switch-profile
const switchProfile = async (profileType: 'personal' | 'merchant', restaurantId?: string) => {
  const token = await SecureStore.getItemAsync('accessToken');
  
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/switch-profile`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ profileType, restaurantId })
  });
  
  return await response.json();
};
```

---

## 🌐 **MARKET WEBVIEW**

### **WebView with Auth Injection**

```typescript
import { WebView } from 'react-native-webview';

const MarketWebView = () => {
  const [token, setToken] = useState('');
  
  useEffect(() => {
    loadToken();
  }, []);
  
  const loadToken = async () => {
    const accessToken = await SecureStore.getItemAsync('accessToken');
    setToken(accessToken);
  };
  
  const injectedJavaScript = `
    (function() {
      // Inject token into WebView
      localStorage.setItem('appzap_token', '${token}');
      
      // Notify web app
      window.postMessage({ type: 'AUTH_READY', token: '${token}' }, '*');
      
      console.log('AppZap: Auth injected');
    })();
    true;
  `;
  
  return (
    <WebView
      source={{ uri: 'https://supply.appzap.la/' }}
      injectedJavaScriptBeforeContentLoaded={injectedJavaScript}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      onMessage={(event) => {
        const message = JSON.parse(event.nativeEvent.data);
        console.log('WebView message:', message);
      }}
    />
  );
};
```

---

## 🎨 **COMPLETE AUTH SERVICE**

```typescript
// services/auth.service.ts
import SecureStore from 'expo-secure-store';

const API_BASE_URL = 'http://localhost:9000';

interface User {
  id: string;
  phone: string;
  fullName: string | null;
  roles: string[];
  activeProfile: 'personal' | 'merchant';
  points: {
    balance: number;
    tier: string;
  };
  hasCompletedOnboarding: boolean;
  firstLogin: boolean;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

class AuthService {
  // Request OTP
  async requestOTP(phone: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        platform: 'APPZAP',
        header: 'AppZap'
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to request OTP');
    }
  }
  
  // Verify OTP & Login
  async verifyOTP(phone: string, otp: string): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Invalid OTP');
    }
    
    const data = await response.json();
    
    // Store tokens securely
    await SecureStore.setItemAsync('accessToken', data.accessToken);
    await SecureStore.setItemAsync('refreshToken', data.refreshToken);
    await SecureStore.setItemAsync('user', JSON.stringify(data.user));
    
    return data;
  }
  
  // Get current user
  async getCurrentUser(): Promise<User> {
    const token = await SecureStore.getItemAsync('accessToken');
    
    if (!token) {
      throw new Error('No access token found');
    }
    
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, try refresh
        await this.refreshToken();
        return this.getCurrentUser(); // Retry
      }
      throw new Error('Failed to get user');
    }
    
    return await response.json();
  }
  
  // Refresh access token
  async refreshToken(): Promise<void> {
    const refreshToken = await SecureStore.getItemAsync('refreshToken');
    
    if (!refreshToken) {
      throw new Error('No refresh token found');
    }
    
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    
    if (!response.ok) {
      // Refresh token expired, logout
      await this.logout();
      throw new Error('Session expired. Please login again.');
    }
    
    const data = await response.json();
    
    // Update tokens
    await SecureStore.setItemAsync('accessToken', data.accessToken);
    await SecureStore.setItemAsync('refreshToken', data.refreshToken);
  }
  
  // Switch profile
  async switchProfile(profileType: 'personal' | 'merchant', restaurantId?: string): Promise<void> {
    const token = await SecureStore.getItemAsync('accessToken');
    
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/switch-profile`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ profileType, restaurantId })
    });
    
    if (!response.ok) {
      throw new Error('Failed to switch profile');
    }
  }
  
  // Logout
  async logout(): Promise<void> {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('user');
  }
  
  // Check if user is logged in
  async isLoggedIn(): Promise<boolean> {
    const token = await SecureStore.getItemAsync('accessToken');
    return !!token;
  }
}

export const authService = new AuthService();
```

---

## 📱 **COMPLETE AUTH CONTEXT (React)**

```typescript
// contexts/AuthContext.tsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { authService } from '../services/auth.service';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (phone: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    checkAuth();
  }, []);
  
  const checkAuth = async () => {
    try {
      const isLoggedIn = await authService.isLoggedIn();
      if (isLoggedIn) {
        const userData = await authService.getCurrentUser();
        setUser(userData);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const login = async (phone: string, otp: string) => {
    const response = await authService.verifyOTP(phone, otp);
    setUser(response.user);
  };
  
  const logout = async () => {
    await authService.logout();
    setUser(null);
  };
  
  const refreshUser = async () => {
    const userData = await authService.getCurrentUser();
    setUser(userData);
  };
  
  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
```

---

## 🔄 **AUTO TOKEN REFRESH**

```typescript
// utils/api.ts
import SecureStore from 'expo-secure-store';

const API_BASE_URL = 'http://localhost:9000';

// Fetch with auto token refresh
export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const token = await SecureStore.getItemAsync('accessToken');
  
  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  });
  
  // If 401, try to refresh token
  if (response.status === 401) {
    try {
      await authService.refreshToken();
      
      // Retry original request with new token
      const newToken = await SecureStore.getItemAsync('accessToken');
      const retryResponse = await fetch(`${API_BASE_URL}${url}`, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${newToken}`,
          'Content-Type': 'application/json',
        }
      });
      
      return retryResponse;
    } catch (error) {
      // Refresh failed, logout
      await authService.logout();
      throw new Error('Session expired');
    }
  }
  
  return response;
};
```

---

## 🧪 **TESTING CHECKLIST**

### **Manual Testing:**

```typescript
// Test 1: Request OTP
await authService.requestOTP('8562093352677');
// Expected: Success message

// Test 2: Verify OTP
const result = await authService.verifyOTP('8562093352677', '123456');
console.log(result.user);
// Expected: User object with tokens

// Test 3: Get current user
const user = await authService.getCurrentUser();
console.log(user);
// Expected: Same user object

// Test 4: Token injection in WebView
// Open Market WebView
// Check: localStorage.getItem('appzap_token')
// Expected: Token string

// Test 5: Logout
await authService.logout();
// Expected: All tokens cleared
```

---

## ❌ **ERROR HANDLING**

```typescript
// Error responses
const handleAPIError = (error: any) => {
  // 400 - Bad Request
  if (error.status === 400) {
    Alert.alert('Error', 'Invalid input. Please check and try again.');
  }
  
  // 401 - Unauthorized
  if (error.status === 401) {
    Alert.alert('Session Expired', 'Please login again.');
    // Navigate to login
  }
  
  // 429 - Too Many Requests
  if (error.status === 429) {
    Alert.alert('Too Many Requests', 'Please wait a moment and try again.');
  }
  
  // 500 - Server Error
  if (error.status >= 500) {
    Alert.alert('Server Error', 'Something went wrong. Please try again later.');
  }
};
```

---

## 📦 **REQUIRED PACKAGES**

### **React Native:**
```bash
npm install @react-navigation/native
npm install @react-navigation/stack
npm install @react-navigation/bottom-tabs
npm install react-native-webview
npm install expo-secure-store
npm install @react-native-async-storage/async-storage
```

### **Flutter:**
```yaml
dependencies:
  webview_flutter: ^4.4.2
  flutter_secure_storage: ^9.0.0
  http: ^1.1.0
  provider: ^6.1.1
```

---

## 🚨 **COMMON ISSUES & FIXES**

### **Issue 1: Token not injected in WebView**
```typescript
// Solution: Use injectedJavaScriptBeforeContentLoaded
injectedJavaScriptBeforeContentLoaded={`
  localStorage.setItem('token', '${token}');
  true; // IMPORTANT: Must return true
`}
```

### **Issue 2: 401 Unauthorized**
```typescript
// Solution: Implement auto token refresh
if (response.status === 401) {
  await authService.refreshToken();
  return retryRequest(); // Retry original request
}
```

### **Issue 3: WebView not loading**
```typescript
// Solution: Add proper permissions
// iOS: Info.plist
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsArbitraryLoads</key>
  <true/>
</dict>

// Android: AndroidManifest.xml
<uses-permission android:name="android.permission.INTERNET"/>
```

---

## 🎯 **PHASE 1 COMPLETE API LIST**

| Endpoint | Method | Auth Required | Purpose |
|----------|--------|---------------|---------|
| `/api/v1/auth/request-otp` | POST | No | Request OTP code |
| `/api/v1/auth/verify-otp` | POST | No | Verify OTP & login |
| `/api/v1/auth/me` | GET | Yes | Get user profile |
| `/api/v1/auth/refresh` | POST | No | Refresh access token |
| `/api/v1/auth/switch-profile` | POST | Yes | Switch Personal/Merchant |

**That's it for Phase 1!** 🎉

---

## 📞 **NEED HELP?**

**Backend API Issues:**
- Check server logs: `npm run dev` (see console)
- Test endpoint: `curl http://localhost:9000/health`
- Contact: api@appzap.la

**Mobile Integration Issues:**
- Token not working? Check `SecureStore.getItemAsync('accessToken')`
- WebView blank? Check console logs
- 401 errors? Try `authService.refreshToken()`

---

**🚀 You're ready to build! Copy these snippets and start coding!**

