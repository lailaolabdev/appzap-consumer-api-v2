# API Documentation

## Overview

The AppZap application uses multiple APIs:

- **Main API**: Restaurant booking and user management
- **Auth API**: Authentication and user authentication (GraphQL)
- **Ingredients API**: Product catalog and ordering system

---

## Base URLs

### Main API

- **Production**: `https://app-api.appzap.la/app`
- **Staging**: `https://staging-api.appzap.com/v1`
- **Development**: `http://localhost:7070`

### Auth API

- **Production**: `https://auth.lailaolab.com`

### Ingredients API

- **Production**: `https://ry5bw19rok.execute-api.ap-southeast-1.amazonaws.com`
- **Development (Android)**: `http://10.0.2.2:8080`
- **Development (iOS/Local)**: `http://127.0.0.1:8080`

---

## Authentication

### Token Storage

- Tokens are stored securely using `flutter_secure_storage`
- Main API uses Bearer token authentication
- Ingredients API uses separate authentication flow

### Headers

```
Content-Type: application/json
Accept: application/json
Authorization: Bearer {token}
```

---

## Main API Endpoints

### 1. Restaurants

#### Get Reservable Restaurants

- **Endpoint**: `GET /v5/reservable-store`
- **Description**: Retrieves list of restaurants that accept reservations
- **Query Parameters**:
  - `page` (optional): Page number
  - `limit` (optional): Items per page (default: 20, max: 100)
  - `categoryId` (optional): Filter by category
- **Response**: Array of restaurant objects

#### Get Recommended Restaurants

- **Endpoint**: `GET /api/resto/recommended`
- **Description**: Gets featured/recommended restaurants
- **Response**: Array of restaurant objects

### 2. Categories

#### Get Categories

- **Endpoint**: `GET /v5/categories`
- **Description**: Retrieves all restaurant categories
- **Response**: Array of category objects

### 3. User Management

#### Get User App Data

- **Endpoint**: `GET /v5/user-app`
- **Description**: Gets current user's app data
- **Headers**: Requires authentication
- **Response**: User app object

#### Get User Apps (Multiple)

- **Endpoint**: `GET /v5/user-apps`
- **Description**: Gets all user apps
- **Headers**: Requires authentication
- **Response**: Array of user app objects

#### Get User App V6

- **Endpoint**: `GET /v6/user-app`
- **Description**: Gets user app data (v6 format)
- **Headers**: Requires authentication
- **Response**: User app object (v6)

### 4. Bookings

#### Get Bookings

- **Endpoint**: `GET /v5/bookings`
- **Description**: Retrieves user's booking history
- **Headers**: Requires authentication
- **Query Parameters**:
  - `status` (optional): Filter by booking status
  - `page` (optional): Page number
  - `limit` (optional): Items per page
- **Response**: Array of booking objects

#### Create Booking

- **Endpoint**: `POST /v5/bookings`
- **Description**: Creates a new restaurant booking
- **Headers**: Requires authentication
- **Request Body**:

```json
{
  "restaurantId": "restaurant_id",
  "date": "2024-01-01",
  "time": "19:00",
  "guests": 2,
  "specialRequests": "Optional notes"
}
```

- **Response**: Booking object

#### Cancel Booking

- **Endpoint**: `DELETE /v5/bookings/{bookingId}`
- **Description**: Cancels an existing booking
- **Headers**: Requires authentication
- **Response**: Success message

### 5. Profile

#### Get Profile

- **Endpoint**: `GET /v5/profile`
- **Description**: Gets user profile information
- **Headers**: Requires authentication
- **Response**: Profile object

#### Update Profile

- **Endpoint**: `PUT /v5/profile`
- **Description**: Updates user profile
- **Headers**: Requires authentication
- **Request Body**:

```json
{
  "name": "User Name",
  "email": "user@example.com",
  "phone": "8562093352677",
  "address": {
    "village": "Village",
    "district": "District",
    "province": "Province",
    "latitude": "17.9757",
    "longitude": "102.6331"
  }
}
```

- **Response**: Updated profile object

### 6. User Points

#### Get User Points

- **Endpoint**: `GET /v5/user-point`
- **Description**: Gets user's loyalty points
- **Headers**: Requires authentication
- **Response**: Points object with balance and history

### 7. Search

#### Search Restaurants

- **Endpoint**: `GET /v5/search`
- **Description**: Searches restaurants by query
- **Query Parameters**:
  - `query` (required): Search term
  - `page` (optional): Page number
  - `limit` (optional): Items per page
- **Response**: Array of matching restaurants

### 8. File Upload

#### Upload File

- **Endpoint**: `POST /uploadfile`
- **Description**: Uploads image or file
- **Headers**: Requires authentication
- **Request**: Multipart form data
- **Response**: File URL

---

## Auth API (GraphQL)

### Base URL

`https://auth.lailaolab.com`

### Mutations

#### Request OTP

```graphql
mutation RequestOtpMutation($data: OtpInput!) {
  requestOtp(data: $data) {
    message
  }
}
```

**Variables**:

```json
{
  "data": {
    "phone": "8562093352677",
    "platform": "APPZAP",
    "header": "AppZap"
  }
}
```

**Response**:

```json
{
  "data": {
    "requestOtp": {
      "message": "OTP sent successfully"
    }
  }
}
```

#### Verify OTP

```graphql
mutation VerifyOtp($data: VerifyOtpInput!, $where: VerifyOtpWhereInput!) {
  verifyOtp(data: $data, where: $where) {
    message
  }
}
```

**Variables**:

```json
{
  "data": {
    "otp": "123456"
  },
  "where": {
    "phone": "8562093352677"
  }
}
```

#### Phone Login

```graphql
mutation PhoneLogin($where: PhoneLoginInput!) {
  phoneLogin(where: $where) {
    accessToken
    refreshToken
    data {
      nickName
      phone
      id
      role
      createdAt
      updatedAt
    }
  }
}
```

**Variables**:

```json
{
  "where": {
    "phone": "8562093352677",
    "otp": "123456"
  }
}
```

#### Signup with Phone

```graphql
mutation SignupWithPhone($data: UserAuthInput!) {
  signupWithPhone(data: $data) {
    accessToken
    refreshToken
    data {
      id
      phone
      role
    }
  }
}
```

#### Update User

```graphql
mutation UpdateUserAuth($where: UserAuthWhereInputOne!, $data: UserAuthInput!) {
  updateUserAuth(where: $where, data: $data) {
    phone
    id
    image
    role
    email
    username
    createdAt
    updatedAt
  }
}
```

#### Refresh Token

```graphql
mutation RegenToken($data: RegenTokenInput!) {
  regenToken(data: $data) {
    accessToken
    refreshToken
    data {
      nickName
      phone
      id
      role
      createdAt
      updatedAt
    }
  }
}
```

---

## Ingredients API

### Authentication

#### Authenticate with Token

- **Endpoint**: `POST /user/authenticate/token`
- **Description**: Authenticates user for Ingredients API
- **Request Body**:

```json
{
  "phone": "8562093352677",
  "exchangeKey": "exchange_key"
}
```

- **Response**:

```json
{
  "accessToken": "token",
  "customerId": "customer_id",
  "timestamp": 1234567890
}
```

**Note**: Tokens are stored locally and reused until expiration.

### Categories

#### Get Categories

- **Endpoint**: `GET /v6/supplier-categories`
- **Description**: Gets all product categories
- **Headers**: Requires Ingredients API authentication
- **Response**:

```json
{
  "data": [
    {
      "id": "category_id",
      "name": "ຊີ້ນໝູ",
      "image": "image_url",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Products

#### Get Products

- **Endpoint**: `GET /mobile/product/get/skip/{skip}/limit/{limit}`
- **Description**: Gets products with pagination
- **Path Parameters**:
  - `skip`: Number of items to skip (default: 0)
  - `limit`: Maximum items to return (default: 24)
- **Query Parameters**:
  - `categoryId` (required): Category ID to filter
  - `createdBy` (required): Seller ID (default: `6683700875395b0f0741b48d`)
- **Headers**: Requires Ingredients API authentication
- **Response**:

```json
{
  "message": "get successful",
  "data": [
    {
      "id": "product_id",
      "name": "ຊີ້ນໝູສົດ",
      "categoryId": "category_id",
      "image": "image_url",
      "prices": [
        {
          "id": "price_id",
          "unit": "ກິໂລ",
          "price": 50000,
          "isDefault": true
        }
      ],
      "lastUpdated": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### Search Products

- **Endpoint**: `GET /v6/supplier-products/search`
- **Description**: Searches products by query
- **Query Parameters**:
  - `query` (required): Search term
  - `categoryId` (optional): Filter by category
  - `skip` (optional): Pagination offset
  - `limit` (optional): Maximum results
- **Headers**: Requires Ingredients API authentication
- **Response**: Same structure as Get Products

### Orders

#### Create Order

- **Endpoint**: `POST /order/lll-create-order`
- **Description**: Creates a new order
- **Headers**: Requires Ingredients API authentication
- **Request Body**:

```json
{
  "items": [
    {
      "productId": "product_id",
      "name": "ຊີ້ນໝູສົດ",
      "quantity": 2.5,
      "unit": "ກິໂລ",
      "price": 50000,
      "priceRecordId": "price_record_id",
      "note": "Optional note"
    }
  ],
  "externalProducts": [
    {
      "name": "Custom Product",
      "quantity": 1,
      "unit": "ຫນ່ວຍ",
      "price": 10000,
      "note": "Special request"
    }
  ],
  "customerId": "customer_id",
  "sellerId": "seller_id",
  "customerInfo": {
    "name": "Customer Name",
    "phone": "8562093352677",
    "village": "Village",
    "district": "District",
    "province": "Province",
    "latitude": "17.9757",
    "longitude": "102.6331"
  }
}
```

- **Response**:

```json
{
  "data": {
    "id": "order_id",
    "status": "pending",
    "totalAmount": 125000,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Get Order History

- **Endpoint**: `GET /v6/supplier-order-history`
- **Description**: Gets order history
- **Query Parameters**:
  - `sellerId` (required): Seller ID
  - `status` (optional): Filter by status (array)
  - `startDate` (optional): ISO date string
  - `endDate` (optional): ISO date string
- **Headers**: Requires Ingredients API authentication
- **Response**: Array of order objects

#### Get Order History by Customer

- **Endpoint**: `GET /order-product/getBy/{customerId}`
- **Description**: Gets orders for a specific customer
- **Path Parameters**:
  - `customerId`: Customer ID
- **Headers**: Requires Ingredients API authentication
- **Response**: Array of order objects

### Seller

#### Get Seller Details

- **Endpoint**: `GET /user/getSingleUserName`
- **Description**: Gets seller information
- **Query Parameters**:
  - `sellerId` (required): Seller ID
- **Headers**: Requires Ingredients API authentication
- **Response**: Seller object

---

## Error Handling

### HTTP Status Codes

- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `429`: Too Many Requests
- `500`: Internal Server Error

### Error Response Format

```json
{
  "error": "Error message",
  "statusCode": 400,
  "message": "Detailed error message"
}
```

### GraphQL Error Format

```json
{
  "errors": [
    {
      "message": "Error message",
      "extensions": {
        "code": "ERROR_CODE"
      }
    }
  ]
}
```

---

## Request Timeouts

- **Connect Timeout**: 60 seconds
- **Receive Timeout**: 60 seconds
- **Send Timeout**: 60 seconds (not supported for GET on web)

---

## Retry Logic

The API client implements automatic retry with exponential backoff:

- **Max Retries**: 2 (3 total attempts)
- **Initial Delay**: 1 second
- **Retryable Errors**:
  - Connection timeouts
  - Receive timeouts
  - Send timeouts
  - Connection errors
  - 5xx server errors
  - 429 Too Many Requests

---

## Pagination

### Default Values

- **Main API**: 20 items per page (max: 100)
- **Ingredients API**: 24 items per page

### Pagination Parameters

- `page`: Page number (1-indexed)
- `limit`: Items per page
- `skip`: Items to skip (0-indexed, Ingredients API)

---

## Image URLs

### Base URL

`https://appzapimglailaolab.s3-ap-southeast-1.amazonaws.com/resized`

### Sizes

- **Small**: `/small/{filename}`
- **Medium**: `/medium/{filename}`

### Example

```
https://appzapimglailaolab.s3-ap-southeast-1.amazonaws.com/resized/small/7ed114a8-5ecf-41ef-9119-1ae71888a1a4.jpeg
```

---

## Rate Limiting

- **Limit**: 100 requests/minute per IP
- **Response**: `429 Too Many Requests` with `Retry-After` header

---

## API Versioning

- **Main API**: Uses `/v5/` and `/v6/` prefixes
- **Ingredients API**: Uses `/v6/` prefix
- Versioned endpoints allow backward compatibility

---

## Notes

1. All timestamps are in ISO 8601 format
2. Phone numbers should include country code (e.g., `8562093352677` for Laos)
3. Prices are in LAK (Lao Kip)
4. All text content supports Lao language (UTF-8)
5. Ingredients API requires separate authentication from Main API
6. Tokens are stored securely and automatically included in requests
