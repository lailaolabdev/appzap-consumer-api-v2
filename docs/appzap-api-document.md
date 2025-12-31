# AppZap API Documentation

## Overview

This document provides comprehensive documentation for all APIs implemented in the AppZap application. The API is organized into multiple versions (v3, v4, v5, v6) with different features and capabilities.

### Base URLs

- **Development**: `http://localhost:7070`
- **Staging**: `https://staging-api.appzap.com`
- **Production**: `https://app-api.appzap.la/app`

### API Versioning

The API uses version prefixes in the URL path:

- `/v3/` - Legacy endpoints
- `/v4/` - Intermediate version
- `/v5/` - Current stable version
- `/v6/` - Latest version with supplier platform integration

---

## Table of Contents

1. [User App Management](#user-app-management)
2. [Store/Restaurant Management](#storerestaurant-management)
3. [Category Management](#category-management)
4. [Booking Management](#booking-management)
5. [Point System](#point-system)
6. [Supplier Platform Integration](#supplier-platform-integration)
7. [File Upload](#file-upload)
8. [Authentication](#authentication)

---

## User App Management

### Version 3 Endpoints

#### Get All User Apps

- **Endpoint**: `GET /v3/user-apps`
- **Description**: Retrieves all user apps
- **Authentication**: Not required
- **Response**: Array of user app objects

#### Get User App by ID

- **Endpoint**: `GET /v3/user-app/:id`
- **Description**: Retrieves a single user app by ID
- **Authentication**: Not required
- **Path Parameters**:
  - `id` (string, required): User app MongoDB ID
- **Response**: User app object

#### Update User App

- **Endpoint**: `PUT /v3/user-app/:id`
- **Description**: Updates a user app
- **Authentication**: Required (Bearer token)
- **Path Parameters**:
  - `id` (string, required): User app MongoDB ID
- **Request Body**: User app fields to update
- **Response**: Updated user app object

#### Create User App Referral

- **Endpoint**: `POST /v3/user-app-referral/`
- **Description**: Creates or updates user app referral
- **Authentication**: Required (Bearer token)
- **Request Body**: Referral data
- **Response**: Referral object

### Version 5 Endpoints

#### Get All Users

- **Endpoint**: `GET /v5/user-apps`
- **Description**: Retrieves all user apps with optional filtering
- **Authentication**: Not required
- **Query Parameters**:
  - `skip` (number, optional): Number of records to skip
  - `limit` (number, optional): Maximum number of records to return
  - `search` (string, optional): Search term for filtering
- **Response**: Array of user app objects

**Example Request**:

```bash
curl -X GET "http://localhost:7070/v5/user-apps?skip=0&limit=20"
```

**Example Response**:

```json
[
  {
    "_id": "672b1ffad6056a60e1c385bb",
    "fullName": "John Doe",
    "phone": "02093352677",
    "email": "john@example.com",
    "role": "APPZAP_USER",
    "createdAt": "2024-11-06T07:51:22.211Z",
    "updatedAt": "2024-11-06T07:51:22.211Z"
  }
]
```

#### Get User by ID

- **Endpoint**: `GET /v5/user-app/:id`
- **Description**: Retrieves a single user app by ID
- **Authentication**: Not required
- **Path Parameters**:
  - `id` (string, required): User app MongoDB ID
- **Response**: User app object

**Example Request**:

```bash
curl -X GET "http://localhost:7070/v5/user-app/672b1ffad6056a60e1c385bb"
```

#### Create User

- **Endpoint**: `POST /v5/user-app`
- **Description**: Creates a new user app. If user with phone already exists, returns existing user.
- **Authentication**: Not required
- **Request Body**:
  ```json
  {
    "phone": "02093352677",
    "fullName": "John Doe",
    "email": "john@example.com",
    "role": "APPZAP_USER"
  }
  ```
- **Response**: Created or existing user app object

**Example Request**:

```bash
curl -X POST "http://localhost:7070/v5/user-app" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "02093352677",
    "fullName": "John Doe",
    "email": "john@example.com"
  }'
```

#### Update User

- **Endpoint**: `PUT /v5/user-app/:id`
- **Description**: Updates an existing user app
- **Authentication**: Not required
- **Path Parameters**:
  - `id` (string, required): User app MongoDB ID
- **Request Body**: User app fields to update
- **Response**: Updated user app object

**Example Request**:

```bash
curl -X PUT "http://localhost:7070/v5/user-app/672b1ffad6056a60e1c385bb" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "John Doe Updated",
    "email": "john.updated@example.com"
  }'
```

#### Generate Referral Code

- **Endpoint**: `GET /v5/user-app/:userId/referral-code`
- **Description**: Generates or retrieves a referral code for a user
- **Authentication**: Not required
- **Path Parameters**:
  - `userId` (string, required): User app MongoDB ID
- **Response**:
  ```json
  {
    "referralCode": "AZ234567A"
  }
  ```

**Note**: Referral codes are generated with format `AZ[UNIQUE_ID][CHECKSUM]` and are unique per user.

#### Validate Referral Code

- **Endpoint**: `GET /v5/user-app/validate-referral/:referralCode`
- **Description**: Validates a referral code and returns the user who owns it
- **Authentication**: Not required
- **Path Parameters**:
  - `referralCode` (string, required): Referral code to validate
- **Response**: User app object if valid, error if invalid

### Version 6 Endpoints

#### Get User

- **Endpoint**: `GET /v6/user-app/:id`
- **Description**: Retrieves a single user from the local database. Returns all fields from the UserApp model, including the `image` field. The `password` field is excluded from the response for security reasons.
- **Authentication**: Not required
- **Path Parameters**:
  - `id` (string, required): User app MongoDB ID
- **Response**: Complete user object with all fields (even if `null`)

**Example Request**:

```bash
curl -X GET "http://localhost:7070/v6/user-app/672b1ffad6056a60e1c385bb"
```

**Example Response**:

```json
{
  "_id": "672b1ffad6056a60e1c385bb",
  "fullName": "Test Update V2",
  "phone": "02093352677",
  "email": "updated@example.com",
  "role": "APPZAP_USER",
  "image": "7ed114a8-5ecf-41ef-9119-1ae71888a1a4.jpeg",
  "username": "tyecode",
  "address": {
    "village": "Updated Village",
    "district": "Updated District",
    "province": "Updated Province",
    "latitude": null,
    "longitude": null
  },
  "gender": "MALE",
  "yearOfBirth": "1999",
  "nickName": "tyecode1",
  "storeId": "61d8019f9d14fc92d015ee8e",
  "fbId": null,
  "appleUserId": null,
  "platform": null,
  "lastLogin": "2024-11-06T07:51:22.462Z",
  "createdAt": "2024-11-06T07:51:22.211Z",
  "updatedAt": "2025-11-12T08:14:42.603Z",
  "note": null,
  "__v": 0
}
```

**Note**: All fields from the UserApp model are included in the response, even if they are `null` or `undefined`. The `password` field is excluded for security reasons.

#### Update User

- **Endpoint**: `PUT /v6/user-app/:id`
- **Description**: Updates a user with automatic synchronization to the supplier platform. This endpoint accepts any fields from the UserApp model and automatically syncs data to the supplier platform when conditions are met.
- **Authentication**: Not required
- **Path Parameters**:
  - `id` (string, required): User app MongoDB ID
- **Request Body**: Any UserApp model fields

**Standard Fields**:

- `fullName` (string): User's full name
- `phoneNumber` (string): Phone number (maps to `phone` in database)
- `email` (string): User's email address
- `role` (string): User role (e.g., "USER", "ADMIN")
- `image` (string): Profile image URL or filename
- `gender` (string): User gender
- `yearOfBirth` (number): Year of birth
- `nickName` (string): User's nickname

**Address Fields** (can be provided individually or as an object):

- `village` (string): Village name
- `district` (string): District name
- `province` (string): Province name
- `latitude` (string): Latitude coordinate
- `longitude` (string): Longitude coordinate

**Example Request - Individual Address Fields**:

```bash
curl -X PUT "http://localhost:7070/v6/user-app/672b1ffad6056a60e1c385bb" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "John Doe",
    "phoneNumber": "2001230123",
    "village": "Test Village",
    "district": "Test District",
    "province": "Test Province",
    "latitude": "17.967671",
    "longitude": "102.643177"
  }'
```

**Example Request - Address Object**:

```bash
curl -X PUT "http://localhost:7070/v6/user-app/672b1ffad6056a60e1c385bb" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Jane Smith",
    "phoneNumber": "2001230124",
    "address": {
      "village": "Village Name",
      "district": "District Name",
      "province": "Province Name",
      "latitude": "18.000000",
      "longitude": "102.700000"
    }
  }'
```

**Success Response (200 OK)**:

```json
{
  "_id": "672b1ffad6056a60e1c385bb",
  "fullName": "Test Update V2",
  "phone": "02093352677",
  "email": "updated@example.com",
  "role": "APPZAP_USER",
  "address": {
    "village": "Updated Village",
    "district": "Updated District",
    "province": "Updated Province",
    "latitude": null,
    "longitude": null
  },
  "createdAt": "2024-11-06T07:51:22.211Z",
  "updatedAt": "2025-11-12T08:14:42.603Z",
  "__v": 0
}
```

**Error Responses**:

- **404 Not Found**: User does not exist

  ```json
  {
    "message": "User not found",
    "code": "USER_NOT_FOUND"
  }
  ```

- **409 Conflict**: Phone number already exists for another user

  ```json
  {
    "message": "Phone number already exists for another user",
    "code": "DUPLICATE_PHONE",
    "existingUserId": "672b1ffad6056a60e1c385bb"
  }
  ```

- **500 Internal Server Error**: Database or server error

**Supplier Platform Sync**:

When the following conditions are met, the API automatically syncs data to the supplier platform:

1. `SUPPLIER_EXCHANGE_KEY` is set in environment variables
2. `phoneNumber` is provided in the request body (or user has existing phone)
3. User exists in the local database

The API maps local UserApp fields to supplier platform fields:

- `fullName` → `firstName`
- `phone` → `phoneNumber` (normalized)
- `address.*` → `address.*`
- `image` → `profileImage`

**Phone Number Normalization**:
Phone numbers are automatically normalized for supplier API calls:

- `02093352677` → `2093352677`
- `8562093352677` → `2093352677`
- `2093352677` → `2093352677` (no change)

**Token Management**:

- Supplier platform access tokens are cached per phone number for 7 days
- Tokens are automatically refreshed when expired
- Failed updates due to expired tokens are automatically retried with fresh tokens

**Important Notes**:

- Protected fields: `_id` and `createdAt` cannot be updated
- `phoneNumber` in request body is mapped to `phone` in database
- Duplicate prevention: Cannot update phone number to one that already exists for another user
- Address fields can be provided individually or as a nested object
- Supplier sync errors do not fail the entire request (error returned in `supplierUpdate` field)

---

## Store/Restaurant Management

### Version 3 Endpoints

#### Get All Stores

- **Endpoint**: `GET /v3/stores`
- **Description**: Retrieves all stores with optional filtering
- **Authentication**: Not required
- **Query Parameters**:
  - `skip` (number, optional): Number of records to skip
  - `limit` (number, optional): Maximum number of records to return
- **Response**: Array of store objects

#### Get Stores for Booking

- **Endpoint**: `GET /v3/stores/booking`
- **Description**: Retrieves stores that accept bookings
- **Authentication**: Not required
- **Response**: Array of store objects

#### Get Single Store

- **Endpoint**: `GET /v3/store`
- **Description**: Retrieves a single store
- **Authentication**: Not required
- **Query Parameters**: Store identifier
- **Response**: Store object

#### Get Stores Count

- **Endpoint**: `GET /v3/stores/count`
- **Description**: Gets total count of stores
- **Authentication**: Not required
- **Response**: Count object

#### Create Store

- **Endpoint**: `POST /v3/store/create`
- **Description**: Creates a new store
- **Authentication**: Required (Bearer token)
- **Request Body**: Store data
- **Response**: Created store object

#### Update Store

- **Endpoint**: `PUT /v3/store/update`
- **Description**: Updates a store
- **Authentication**: Required (Bearer token)
- **Request Body**: Store fields to update
- **Response**: Updated store object

#### Delete Store

- **Endpoint**: `DELETE /v3/store/:id`
- **Description**: Deletes a store
- **Authentication**: Required (Bearer token)
- **Path Parameters**:
  - `id` (string, required): Store MongoDB ID
- **Response**: Success message

### Version 4 Endpoints

#### Update Store First Currency

- **Endpoint**: `PUT /v4/store/update-first-currency`
- **Description**: Updates the first currency for a store
- **Authentication**: Required (POS only)
- **Request Body**: Currency data
- **Response**: Updated store object

#### Update Store PIN

- **Endpoint**: `PUT /v4/store/pin`
- **Description**: Updates store PIN
- **Authentication**: Required (POS only)
- **Request Body**: PIN data
- **Response**: Updated store object

#### Get Branch Stores

- **Endpoint**: `GET /v4/branch-store`
- **Description**: Retrieves branch stores
- **Authentication**: Not required
- **Response**: Array of branch store objects

### Version 5 Endpoints

#### Get Reservable Stores

- **Endpoint**: `GET /v5/reservable-store`
- **Description**: Retrieves list of restaurants that accept reservations
- **Authentication**: Not required
- **Query Parameters**:
  - `page` (optional): Page number
  - `limit` (optional): Items per page (default: 20, max: 100)
  - `categoryId` (optional): Filter by category
  - `search` (optional): Search term
  - `isTest` (optional): Include test stores (default: false)
- **Response**: Array of restaurant objects with reservation details

**Example Request**:

```bash
curl -X GET "http://localhost:7070/v5/reservable-store?page=1&limit=20"
```

**Example Response**:

```json
[
  {
    "_id": "61d8019f9d14fc92d015ee8e",
    "name": "Restaurant Name",
    "name_en": "Restaurant Name EN",
    "address": "Restaurant Address",
    "phone": "02012345678",
    "isReservable": true,
    "hasPOS": true,
    "averageStars": 4.5,
    "reviewCount": 120,
    "tableCount": 15,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### Get Recommended Stores

- **Endpoint**: `GET /v5/recommended-store`
- **Description**: Gets featured/recommended restaurants
- **Authentication**: Not required
- **Response**: Array of restaurant objects

#### Get Reservable Store by ID

- **Endpoint**: `GET /v5/reservable-store/:id`
- **Description**: Retrieves a single reservable store by ID
- **Authentication**: Not required
- **Path Parameters**:
  - `id` (string, required): Store MongoDB ID
- **Response**: Store object

#### Update Store Average Stars

- **Endpoint**: `PUT /v5/reservable-store/update`
- **Description**: Updates store average star rating
- **Authentication**: Not required
- **Request Body**: Star rating data
- **Response**: Updated store object

#### Update Store POS

- **Endpoint**: `PUT /v5/stores/update-pos`
- **Description**: Updates POS-related store information
- **Authentication**: Not required
- **Request Body**: POS data
- **Response**: Updated store object

#### Update Reservation for POS Stores

- **Endpoint**: `PUT /v5/stores/update-reservation-for-pos`
- **Description**: Updates reservation settings for all POS stores
- **Authentication**: Not required
- **Response**: Update result

#### Update Store Chat Room ID

- **Endpoint**: `PUT /v5/stores/update-chat-room-id/:storeId`
- **Description**: Updates chat room ID for a store
- **Authentication**: Not required
- **Path Parameters**:
  - `storeId` (string, required): Store MongoDB ID
- **Request Body**: Chat room ID
- **Response**: Updated store object

#### Update Store Gallery

- **Endpoint**: `PUT /v5/store/gallery/:storeId/update`
- **Description**: Updates store gallery images
- **Authentication**: Not required
- **Path Parameters**:
  - `storeId` (string, required): Store MongoDB ID
- **Request Body**: Gallery images array
- **Response**: Updated store object

---

## Category Management

### Version 3 Endpoints

#### Get All Categories

- **Endpoint**: `GET /v3/categories`
- **Description**: Retrieves all restaurant categories
- **Authentication**: Not required
- **Response**: Array of category objects

**Example Request**:

```bash
curl -X GET "http://localhost:7070/v3/categories"
```

**Example Response**:

```json
[
  {
    "_id": "61d8019f9d14fc92d015ee8f",
    "name": "Italian",
    "name_en": "Italian",
    "image": "italian.png",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### Get Category by ID

- **Endpoint**: `GET /v3/category/:id`
- **Description**: Retrieves a single category by ID
- **Authentication**: Not required
- **Path Parameters**:
  - `id` (string, required): Category MongoDB ID
- **Response**: Category object

#### Create Category

- **Endpoint**: `POST /v3/category/create`
- **Description**: Creates a new category
- **Authentication**: Not required
- **Request Body**: Category data
- **Response**: Created category object

#### Update Category

- **Endpoint**: `PUT /v3/category/update`
- **Description**: Updates a category
- **Authentication**: Not required
- **Request Body**: Category fields to update
- **Response**: Updated category object

#### Delete Category

- **Endpoint**: `DELETE /v3/category/delete/:id`
- **Description**: Deletes a category
- **Authentication**: Not required
- **Path Parameters**:
  - `id` (string, required): Category MongoDB ID
- **Response**: Success message

---

## Booking Management

### Version 4 Endpoints

#### Create Booking (Client)

- **Endpoint**: `POST /v4/bookingClientCreateOne`
- **Description**: Creates a new booking from client
- **Authentication**: Not required
- **Request Body**: Booking data
- **Response**: Created booking object

#### Create Booking Table

- **Endpoint**: `POST /v4/create-booking`
- **Description**: Creates a new table booking
- **Authentication**: Not required
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

**Example Request**:

```bash
curl -X POST "http://localhost:7070/v4/create-booking" \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantId": "61d8019f9d14fc92d015ee8e",
    "date": "2024-01-01",
    "time": "19:00",
    "guests": 2,
    "specialRequests": "Window seat preferred"
  }'
```

#### Get Booking by ID

- **Endpoint**: `GET /v4/booking-one/:id`
- **Description**: Retrieves a single booking by ID
- **Authentication**: Not required
- **Path Parameters**:
  - `id` (string, required): Booking MongoDB ID
- **Response**: Booking object

#### Get Booking History

- **Endpoint**: `GET /v4/history-booking/:id`
- **Description**: Retrieves booking history for a user
- **Authentication**: Not required
- **Path Parameters**:
  - `id` (string, required): User MongoDB ID
- **Response**: Array of booking objects

---

## Point System

### Version 4 Endpoints

#### Get Point by ID

- **Endpoint**: `POST /v4/get-point/:getPointId`
- **Description**: Retrieves a point record by ID
- **Authentication**: Required (Bearer token)
- **Path Parameters**:
  - `getPointId` (string, required): Point MongoDB ID
- **Response**: Point object

#### Get Point by Code

- **Endpoint**: `POST /v4/get-point-code/:code`
- **Description**: Retrieves a point record by code
- **Authentication**: Required (Bearer token)
- **Path Parameters**:
  - `code` (string, required): Point code
- **Response**: Point object

#### Create Point

- **Endpoint**: `POST /v4/get-point-create`
- **Description**: Creates a new point record
- **Authentication**: Required (Bearer token)
- **Request Body**: Point data
- **Response**: Created point object

#### Get Point List

- **Endpoint**: `GET /v4/get-point-list`
- **Description**: Retrieves list of points
- **Authentication**: Required (Bearer token)
- **Response**: Array of point objects

#### Get User Points

- **Endpoint**: `GET /v4/get-user-point`
- **Description**: Gets current user's points
- **Authentication**: Required (Bearer token)
- **Response**: Points object

#### Delete Point

- **Endpoint**: `DELETE /v4/get-point/:getPointId`
- **Description**: Deletes a point record
- **Authentication**: Required (Bearer token)
- **Path Parameters**:
  - `getPointId` (string, required): Point MongoDB ID
- **Response**: Success message

### Version 5 Endpoints

#### Get User Points by User ID

- **Endpoint**: `GET /v5/user-point/:id`
- **Description**: Gets user's total loyalty points by user ID
- **Authentication**: Not required
- **Path Parameters**:
  - `id` (string, required): User MongoDB ID
- **Response**:
  ```json
  {
    "totalPoints": 1500
  }
  ```

**Example Request**:

```bash
curl -X GET "http://localhost:7070/v5/user-point/672b1ffad6056a60e1c385bb"
```

**Example Response**:

```json
{
  "totalPoints": 1500
}
```

#### Create Point

- **Endpoint**: `POST /v5/user-point/create`
- **Description**: Creates a new point record for a user
- **Authentication**: Not required
- **Request Body**:
  ```json
  {
    "createdBy": "user_id",
    "point": 100,
    "description": "Points earned from purchase"
  }
  ```
- **Response**: Created point object

#### Trade Points for Gift

- **Endpoint**: `POST /v5/user-point/trade-gift`
- **Description**: Trades user points for a gift
- **Authentication**: Required (Bearer token)
- **Request Body**: Gift trade data
- **Response**: Trade result

### Admin Point Management (v5)

All admin endpoints require authentication via `verifyTokenWithEnv` middleware.

#### Get Point Statistics

- **Endpoint**: `GET /v5/admin/points/statistics`
- **Description**: Gets point statistics and analytics
- **Authentication**: Required (Admin)
- **Query Parameters**:
  - `startDate` (optional): Start date filter
  - `endDate` (optional): End date filter
- **Response**: Statistics object

#### Get Points by User

- **Endpoint**: `GET /v5/admin/points/user/:userId`
- **Description**: Gets all points for a specific user
- **Authentication**: Required (Admin)
- **Path Parameters**:
  - `userId` (string, required): User MongoDB ID
- **Response**: Array of point objects

#### Get Point Trends

- **Endpoint**: `GET /v5/admin/points/trends`
- **Description**: Gets point trends over time
- **Authentication**: Required (Admin)
- **Query Parameters**:
  - `period` (optional): Time period (day, week, month)
- **Response**: Trends data

#### Export Points

- **Endpoint**: `GET /v5/admin/points/export`
- **Description**: Exports points data (CSV/JSON)
- **Authentication**: Required (Admin)
- **Query Parameters**:
  - `format` (optional): Export format (csv, json)
- **Response**: Exported data

#### Get Point Activity Summary

- **Endpoint**: `GET /v5/admin/points/activity-summary`
- **Description**: Gets activity summary for points
- **Authentication**: Required (Admin)
- **Response**: Activity summary object

#### Get All Points

- **Endpoint**: `GET /v5/admin/points`
- **Description**: Gets all points with pagination and filters
- **Authentication**: Required (Admin)
- **Query Parameters**:
  - `page` (optional): Page number
  - `limit` (optional): Items per page
  - `userId` (optional): Filter by user ID
  - `startDate` (optional): Start date filter
  - `endDate` (optional): End date filter
  - `search` (optional): Search term
- **Response**: Paginated array of point objects

---

## Supplier Platform Integration

The supplier platform integration provides access to product catalogs, categories, authentication, and order history from an external supplier API.

### Base Configuration

The supplier platform URL is configured via environment variable:

- `SUPPLIER_URL`: Supplier platform base URL (default: `http://localhost:8080`)
- `SUPPLIER_EXCHANGE_KEY`: Exchange key for authentication (required for user sync and authentication)

### Version 6 Endpoints

#### Get Supplier Products

- **Endpoint**: `GET /v6/supplier-products`
- **Description**: Fetch products from the supplier platform. This endpoint automatically includes the `createdBy` parameter and passes through all query parameters for filtering and pagination.
- **Authentication**: Not required
- **Query Parameters**:
  - `categoryId` (string, optional): Filter products by category ID
  - `skip` (number, optional): Number of products to skip (for pagination)
  - `limit` (number, optional): Maximum number of products to return
  - `*` (any, optional): Any other query parameters are passed through

**Note**: The `createdBy` parameter is automatically included with a hardcoded value and does not need to be provided.

**Example Request**:

```bash
curl -X GET "http://localhost:7070/v6/supplier-products?categoryId=65ae2c09fc7d16fa5fa3b257&skip=0&limit=10"
```

**Example Response**:

```json
{
  "message": "get successful",
  "total": 233,
  "data": [
    {
      "_id": "668379b39613cba3aca724f3",
      "productName": "ກະທຽມຈຽວ",
      "productCode": "AZ12695",
      "description": "ກະ​ທຽມ​ຈຽວ​ລຸ້ນ​ປະ​ສົມ​ແປງ ຍົກ​ຖົງ 15 ກິ​ໂລ 440.000ກີບ",
      "images": ["fadb6816-35fc-4084-8dfa-59812c0d6214.jpeg"],
      "categoryId": {
        "_id": "65ae2c09fc7d16fa5fa3b257",
        "categoryName": "ເຄື່ອງແຫ້ງ",
        "image": "khg_heng.png",
        "priority": 7
      },
      "priceRecords": [
        {
          "_id": "68fb0e8759dd0da4c455cd56",
          "productName": "ກະທຽມຈຽວ",
          "purchasePrice": 100000,
          "buyPrice": 105000,
          "unitName": "ກິໂລ"
        }
      ],
      "promotionDetail": [],
      "promotionIsActive": false
    }
  ]
}
```

#### Get Supplier Categories

- **Endpoint**: `GET /v6/supplier-categories`
- **Description**: Fetch categories from the supplier platform. Returns all available product categories.
- **Authentication**: Not required

**Example Request**:

```bash
curl -X GET "http://localhost:7070/v6/supplier-categories"
```

**Example Response**:

```json
{
  "message": "get successful",
  "data": [
    {
      "_id": "6567082a91ce032d3701b51b",
      "categoryName": "ຊີ້ນໝູ",
      "image": "sin.png",
      "priority": 1,
      "productCount": 57
    },
    {
      "_id": "65ae2bf1fc7d16fa5fa3b24e",
      "categoryName": "ຊີ້ນງົວ",
      "image": "sin.png",
      "priority": 2,
      "productCount": 46
    }
  ]
}
```

#### Authenticate with Supplier

- **Endpoint**: `POST /v6/supplier-authenticate`
- **Description**: Authenticate with the supplier platform using phone number and exchange key. Returns access token, refresh token, and user information.
- **Authentication**: Not required
- **Request Body**:
  ```json
  {
    "phoneNumber": "2093352677",
    "exchangeKey": "your-exchange-key-here"
  }
  ```

**Note**: The `phoneNumber` can be provided in any format (e.g., `02093352677`, `8562093352677`, or `2093352677`). It will be automatically normalized to supplier format (`2093352677`) before sending to the supplier API.

**Example Request**:

```bash
curl -X POST "http://localhost:7070/v6/supplier-authenticate" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "2093352677",
    "exchangeKey": "2275bcdc6af6e3655ba686a87ae2dd11e29d7a66516614a767308133b686ecbb"
  }'
```

**Example Response**:

```json
{
  "message": "Login successful",
  "user": {
    "_id": "6911ace74d1943f8c886df1e",
    "firstName": "",
    "userName": "2093352677",
    "phoneNumber": "2093352677",
    "role": "CUSTOMER",
    "address": {
      "village": "",
      "district": "",
      "province": ""
    },
    "shipping": 0,
    "service": 0,
    "serviceFeePerKat": 0,
    "serviceFeePerMuen": 0,
    "userBillTypes": "PERCENTAGE",
    "isDeleted": false,
    "supplierPercent": 0,
    "systemPercent": 0,
    "supplierPercentWithProCat": [],
    "systemPercentWithProCat": [],
    "createdAt": "2025-11-10T09:14:15.710Z",
    "updatedAt": "2025-11-10T09:14:15.710Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Note**: The `_id` field in the `user` object is the supplier user ID. This ID should be used when making requests to supplier endpoints that require a user ID (e.g., `customerId` parameter in order history endpoints).

**Error Responses**:

- **400 Bad Request - Missing Required Fields**:

  ```json
  {
    "message": "phoneNumber is required",
    "code": "MISSING_PHONE_NUMBER"
  }
  ```

- **500 Internal Server Error**:
  ```json
  {
    "message": "Error authenticating with supplier",
    "code": "SUPPLIER_API_ERROR",
    "details": { ... }
  }
  ```

#### Get Supplier Order History

- **Endpoint**: `GET /v6/supplier-order-history` or `GET /v6/supplier-order-history/:customerId`
- **Description**: Fetch order history from the supplier platform. This endpoint automatically includes the `sellerId` parameter and default status values. Requires Bearer token authentication.
- **Authentication**: Required (Bearer token in `Authorization` header)
- **Query Parameters**:
  - `status` (string, optional): Order status filter (comma-separated). If not provided, defaults to: `PENDING,CONFIRMED,PROCESSING,READY_FOR_PICKUP,AWAITING_PAYMENT`
  - `startDate` (string, optional): Start date filter (format: `YYYY-MM-DD`)
  - `endDate` (string, optional): End date filter (format: `YYYY-MM-DD`)
  - `customerId` (string, optional): Filter orders by customer ID
  - `*` (any, optional): Any other query parameters are passed through to the supplier API

**Note**: The `sellerId` parameter is automatically included with a hardcoded value (`6683700875395b0f0741b48d`) and does not need to be provided.

**Example Request**:

```bash
curl -X GET "http://localhost:7070/v6/supplier-order-history?customerId=69085fd66601a177ddb3d112&startDate=2025-09-23&endDate=2025-09-30" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Example Response**:

```json
{
  "message": "SUCCESS",
  "totalOrder": 3,
  "data": [
    {
      "_id": "6912b39159469f77927fc1e9",
      "orderCode": "2511110002",
      "customerId": {
        "_id": "69085fd66601a177ddb3d112",
        "firstName": "Tyecode",
        "userName": "2093352677",
        "phoneNumber": "2093352677",
        "address": {
          "village": "Don Noun",
          "district": "ເມືອງໄຊທານີ",
          "province": "ນະຄອນຫຼວງວຽງຈັນ",
          "latitude": "17.9776902",
          "longitude": "102.6483349"
        },
        "shipping": 0,
        "service": 0,
        "userBillTypes": "PERCENTAGE",
        "profileImage": "26f0d866-e976-41b5-ac98-25bd6dd76520.jpeg"
      },
      "orderProducts": [
        {
          "productId": {
            "categoryId": "65ae2bf1fc7d16fa5fa3b24e"
          },
          "categoryName": "ຊີ້ນງົວ",
          "unitId": "65670ab28ea99f75b60ce710",
          "quantity": 2,
          "priceRecordId": {
            "_id": "6912b39159469f77927fc1e7",
            "productName": "ລີ້ນງົວ",
            "purchasePrice": 100000,
            "buyPrice": 100000,
            "weightToKg": 1,
            "unitName": "ກິໂລ",
            "unitId": "65670ab28ea99f75b60ce710"
          },
          "note": ""
        }
      ],
      "billTypes": "PERCENTAGE",
      "status": "PENDING",
      "statusClaim": "NORMAL",
      "isDeleted": false,
      "checkoutDate": null,
      "discountPercent": 0,
      "discountPrice": 0,
      "discountType": "PERCENT",
      "deliveryFee": 0,
      "supplierPercentWithProCat": [],
      "systemPercentWithProCat": [],
      "createdAt": "2025-11-11T03:54:57.282Z",
      "updatedAt": "2025-11-11T03:54:57.282Z"
    }
  ]
}
```

**Error Responses**:

- **401 Unauthorized - Missing Bearer Token**:

  ```json
  {
    "message": "Bearer token is required",
    "code": "MISSING_AUTHORIZATION_TOKEN"
  }
  ```

- **500 Internal Server Error**:
  ```json
  {
    "message": "Error fetching supplier order history",
    "code": "SUPPLIER_API_ERROR",
    "details": { ... }
  }
  ```

**Important Notes**:

- Bearer token is required in the `Authorization` header
- Get a token using `/v6/supplier-authenticate` endpoint
- The `sellerId` parameter is automatically included
- Default status includes: `PENDING,CONFIRMED,PROCESSING,READY_FOR_PICKUP,AWAITING_PAYMENT`
- You can override the default status by providing your own `status` parameter
- The endpoint returns the exact response format from the supplier platform

---

## File Upload

### Upload File

- **Endpoint**: `POST /uploadfile`
- **Description**: Uploads image or file and returns a signed URL
- **Authentication**: Not required
- **Request**: Multipart form data with file
- **Response**: File URL or signed URL

**Example Request**:

```bash
curl -X POST "http://localhost:7070/uploadfile" \
  -F "file=@/path/to/image.jpg"
```

**Example Response**:

```json
{
  "url": "https://appzapimglailaolab.s3-ap-southeast-1.amazonaws.com/resized/small/7ed114a8-5ecf-41ef-9119-1ae71888a1a4.jpeg"
}
```

**Image URL Format**:

- **Base URL**: `https://appzapimglailaolab.s3-ap-southeast-1.amazonaws.com/resized`
- **Small**: `/small/{filename}`
- **Medium**: `/medium/{filename}`

---

## Authentication

### Version 3 Endpoints

#### Admin Login

- **Endpoint**: `POST /v3/admin/login`
- **Description**: Admin login endpoint
- **Authentication**: Not required
- **Request Body**:
  ```json
  {
    "email": "admin@example.com",
    "password": "password"
  }
  ```
- **Response**: Authentication token

#### User Open Table QR

- **Endpoint**: `POST /v3/user/open-table-qr`
- **Description**: Opens table using QR code
- **Authentication**: Not required
- **Request Body**: QR code data
- **Response**: Table and token information

#### User Open Code

- **Endpoint**: `POST /v3/user/open-code`
- **Description**: Opens table using code
- **Authentication**: Not required
- **Request Body**: Code data
- **Response**: Table and token information

#### Get Profile

- **Endpoint**: `POST /v3/profile`
- **Description**: Gets user profile information
- **Authentication**: Required (Bearer token)
- **Response**: Profile object

#### Staff Token Bill

- **Endpoint**: `POST /v4/staff/token-bill/:billId`
- **Description**: Gets token for staff bill access
- **Authentication**: Not required
- **Path Parameters**:
  - `billId` (string, required): Bill MongoDB ID
- **Response**: Token object

#### User Token Bill

- **Endpoint**: `POST /v4/user/token-bill/:billId`
- **Description**: Gets token for user bill access
- **Authentication**: Not required
- **Path Parameters**:
  - `billId` (string, required): Bill MongoDB ID
- **Response**: Token object

### Version 5 Endpoints

#### User Open Table QR

- **Endpoint**: `POST /v5/user/open-table-qr`
- **Description**: Opens table using QR code (v5 version)
- **Authentication**: Not required
- **Request Body**: QR code data
- **Response**: Table and token information

---

## Error Handling

### HTTP Status Codes

- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `409`: Conflict (e.g., duplicate phone number)
- `429`: Too Many Requests
- `500`: Internal Server Error

### Error Response Format

```json
{
  "message": "Error message",
  "code": "ERROR_CODE",
  "statusCode": 400
}
```

### Common Error Codes

- `USER_NOT_FOUND`: User does not exist
- `DUPLICATE_PHONE`: Phone number already exists for another user
- `MISSING_PHONE_NUMBER`: Phone number is required
- `MISSING_EXCHANGE_KEY`: Exchange key is required
- `MISSING_AUTHORIZATION_TOKEN`: Bearer token is required
- `SUPPLIER_API_ERROR`: Error from supplier platform
- `INTERNAL_SERVER_ERROR`: Server error

---

## Request/Response Format

### Content Type

All requests should use:

```
Content-Type: application/json
```

All responses are in JSON format.

### Headers

Common headers:

```
Content-Type: application/json
Accept: application/json
Authorization: Bearer {token}
```

### Pagination

Pagination is typically handled via query parameters:

- `page`: Page number (1-indexed)
- `limit`: Items per page
- `skip`: Items to skip (0-indexed)

Default values:

- Main API: 20 items per page (max: 100)
- Supplier API: 24 items per page

---

## Environment Variables

### Required Environment Variables

```env
# Database
MONGODB_URI=mongodb://localhost:27017/appzap_app
MONGODB_URI_FOR_APP=mongodb://localhost:27017/appzap_app

# Supplier Platform
SUPPLIER_URL=http://localhost:8080
# Or production: https://ry5bw19rok.execute-api.ap-southeast-1.amazonaws.com
SUPPLIER_EXCHANGE_KEY=your-exchange-key-here

# JWT Secret
TOKKEN_KEY=your-secret-key-here
```

### Optional Environment Variables

```env
# Admin Authentication
ADMIN_EMAIL=admin@appzap.la
ADMIN_PASSWORD=Admin123!@#
```

---

## Notes

1. **Phone Number Formats**: Phone numbers can be provided in various formats (e.g., `02093352677`, `8562093352677`, `2093352677`). The API automatically normalizes them for supplier platform calls.

2. **Token Caching**: Supplier platform access tokens are cached per phone number for 7 days in `.supplier-token-cache.json`.

3. **Automatic Retry**: Failed updates due to expired tokens are automatically retried with fresh tokens.

4. **Field Mapping**: The v6 update endpoint maps local fields to supplier platform fields:

   - `fullName` → `firstName`
   - `phoneNumber` → `phoneNumber` (normalized)
   - `address.*` → `address.*`
   - `image` → `profileImage`

5. **Complete Field Response**: The v6 GET endpoint returns all fields from the UserApp model, even if they are `null` or `undefined`. The `password` field is excluded for security reasons.

6. **Duplicate Prevention**: The v6 update endpoint prevents updating a user's phone number to one that already exists for another user.

7. **Address Fields**: Address fields can be provided individually or as a nested object. Both formats are merged into the `address` object in the database.

8. **Supplier Sync**: Supplier sync only occurs when `SUPPLIER_EXCHANGE_KEY` and `phoneNumber` (or user's existing phone) are provided.

9. **Update Only**: The v6 API is designed to update existing users only. Users should already exist in the database.

10. **All timestamps are in ISO 8601 format** (e.g., `2024-11-06T07:51:22.211Z`)

11. **Prices are in LAK (Lao Kip)**

12. **All text content supports Lao language (UTF-8)**

---

## Related Documentation

- [User App V6 API Documentation](user-app-v6-api.md) - Detailed v6 API documentation
- [API Index](api-index.md) - Complete API documentation index
- [Point Admin API](point-admin-api.md) - Point management and analytics
- [Gift API](gift-api.md) - Gift management system

---

## Support

For API support and questions, refer to the individual documentation files or contact the development team.
