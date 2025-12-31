# Supplier API Documentation

## Base URL
```
Production: https://your-domain.com
Development: http://localhost:{PORT}
```

## Version
API Version: 2.0.1

---

## Table of Contents
1. [Categories APIs](#categories-apis)
2. [Products/Menu APIs](#productsmenu-apis)
3. [Authentication](#authentication)
4. [Error Responses](#error-responses)

---

## Categories APIs

### 1. Get All Categories (Regular)

Get all regular product categories with product count.

**Endpoint:**
```
GET /category/get
```

**Authentication:** ❌ Not Required

**Response:**
```json
{
  "message": "get successful",
  "data": [
    {
      "_id": "64a5f8c9e4b0d1234567890a",
      "categoryName": "Vegetables",
      "image": "https://example.com/image.jpg",
      "priority": 1,
      "productCount": 45,
      "createdBy": "64a5f8c9e4b0d1234567890b"
    },
    {
      "_id": "64a5f8c9e4b0d1234567890c",
      "categoryName": "Fruits",
      "image": "https://example.com/fruits.jpg",
      "priority": 2,
      "productCount": 32,
      "createdBy": "64a5f8c9e4b0d1234567890d"
    }
  ]
}
```

**Response Fields:**
- `_id`: Category unique identifier
- `categoryName`: Name of the category
- `image`: Category image URL
- `priority`: Display order priority (sorted ascending)
- `productCount`: Number of products in this category
- `createdBy`: User ID who created the category

---

### 2. Get All Supplier Categories

Get all supplier-specific product categories.

**Endpoint:**
```
GET /supplier-categories
```

**Authentication:** ❌ Not Required

**Response:**
```json
{
  "message": "SUCCESS",
  "data": [
    {
      "_id": "64a5f8c9e4b0d1234567890e",
      "categoryName": "Fresh Produce",
      "description": "Fresh vegetables and fruits from local suppliers",
      "image": "https://example.com/fresh-produce.jpg",
      "isDeleted": false,
      "createdBy": "64a5f8c9e4b0d1234567890f",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    {
      "_id": "64a5f8c9e4b0d123456789aa",
      "categoryName": "Dairy Products",
      "description": "Milk, cheese, and other dairy items",
      "image": "https://example.com/dairy.jpg",
      "isDeleted": false,
      "createdBy": "64a5f8c9e4b0d1234567890f",
      "createdAt": "2024-01-16T08:20:00.000Z",
      "updatedAt": "2024-01-16T08:20:00.000Z"
    }
  ]
}
```

**Response Fields:**
- `_id`: Supplier category unique identifier
- `categoryName`: Name of the supplier category
- `description`: Detailed description of the category
- `image`: Category image URL
- `isDeleted`: Soft delete flag (always false in response)
- `createdBy`: User ID who created the category
- `createdAt`: Timestamp when category was created
- `updatedAt`: Timestamp when category was last updated

**Notes:**
- Categories are sorted by creation date (oldest first)
- Only non-deleted categories are returned (`isDeleted: false`)

---

### 3. Get Single Supplier Category by ID

Get details of a specific supplier category.

**Endpoint:**
```
GET /supplier-category/:id
```

**Authentication:** ❌ Not Required

**URL Parameters:**
- `id` (required): Category ID

**Example Request:**
```
GET /supplier-category/64a5f8c9e4b0d1234567890e
```

**Success Response (200):**
```json
{
  "message": "SUCCESS",
  "data": {
    "_id": "64a5f8c9e4b0d1234567890e",
    "categoryName": "Fresh Produce",
    "description": "Fresh vegetables and fruits from local suppliers",
    "image": "https://example.com/fresh-produce.jpg",
    "isDeleted": false,
    "createdBy": "64a5f8c9e4b0d1234567890f",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Response (404):**
```json
{
  "error": "Supplier category not found"
}
```

---

## Products/Menu APIs

### 1. Get All Products

Get all products with full details, including pricing, units, categories, and promotions.

**Endpoint:**
```
GET /product/get
```

**Authentication:** ❌ Not Required

**Query Parameters:**
- `skip` (optional): Number of records to skip for pagination
- `limit` (optional): Number of records to return
- `categoryId` (optional): Filter by category ID
- `productName` (optional): Search by product name (case-insensitive, partial match)
- `createdBy` (optional): Filter by creator user ID
- `supplierId` (optional): Filter by supplier ID

**Example Requests:**
```
GET /product/get
GET /product/get?skip=0&limit=20
GET /product/get?categoryId=64a5f8c9e4b0d1234567890a
GET /product/get?productName=tomato
GET /product/get?skip=20&limit=20&categoryId=64a5f8c9e4b0d1234567890a
```

**Response:**
```json
{
  "message": "get successful",
  "total": 150,
  "data": [
    {
      "_id": "64a5f8c9e4b0d123456789bb",
      "productName": "Fresh Tomatoes",
      "productCode": "PRD-001234",
      "detail": "Fresh organic tomatoes",
      "description": "Locally sourced organic tomatoes, perfect for salads",
      "images": [
        "https://example.com/tomato1.jpg",
        "https://example.com/tomato2.jpg"
      ],
      "categoryId": {
        "_id": "64a5f8c9e4b0d1234567890a",
        "categoryName": "Vegetables",
        "image": "https://example.com/vegetables.jpg"
      },
      "subCategoryId": "64a5f8c9e4b0d123456789cc",
      "supplierId": {
        "_id": "64a5f8c9e4b0d123456789dd",
        "firstName": "Green Farm",
        "phoneNumber": "+1234567890"
      },
      "unitId": "64a5f8c9e4b0d123456789ee",
      "priceRecords": [
        {
          "_id": "64a5f8c9e4b0d123456789ff",
          "productId": "64a5f8c9e4b0d123456789bb",
          "buyPrice": 5000,
          "unitId": {
            "_id": "64a5f8c9e4b0d123456789ee",
            "unitName": "kg",
            "unitNameKh": "គីឡូក្រាម"
          },
          "unitName": "kg",
          "weight": 1,
          "productName": "Fresh Tomatoes",
          "sellerId": {
            "_id": "64a5f8c9e4b0d123456789gg",
            "firstName": "John",
            "lastName": "Doe",
            "email": "john@example.com",
            "role": "SELLER"
          }
        }
      ],
      "promotionDetail": [
        {
          "_id": "64a5f8c9e4b0d123456789hh",
          "productId": "64a5f8c9e4b0d123456789bb",
          "promotionType": "PERCENTAGE",
          "discountValue": 10,
          "startDate": "2024-01-01T00:00:00.000Z",
          "endDate": "2024-01-31T23:59:59.000Z",
          "isActive": true,
          "isDeleted": false
        }
      ],
      "promotionIsActive": true,
      "createdBy": "64a5f8c9e4b0d123456789gg"
    }
  ]
}
```

**Response Fields:**

**Product Object:**
- `_id`: Product unique identifier
- `productName`: Name of the product
- `productCode`: Unique product code (auto-generated)
- `detail`: Short product detail
- `description`: Detailed product description
- `images`: Array of product image URLs
- `categoryId`: Populated category object
- `subCategoryId`: Subcategory ID reference
- `supplierId`: Populated supplier object with basic info
- `unitId`: Default unit ID
- `priceRecords`: Array of pricing information with units
- `promotionDetail`: Array of active promotions
- `promotionIsActive`: Boolean indicating if product has active promotions
- `createdBy`: User ID who created the product

**Price Record Object:**
- `_id`: Price record ID
- `productId`: Reference to product
- `buyPrice`: Price in smallest currency unit (e.g., cents)
- `unitId`: Populated unit object
- `unitName`: Name of the unit
- `weight`: Quantity/weight for this price
- `sellerId`: Populated seller information

**Category Object:**
- `_id`: Category ID
- `categoryName`: Category name
- `image`: Category image URL

**Supplier Object:**
- `_id`: Supplier ID
- `firstName`: Supplier name
- `phoneNumber`: Contact number

**Unit Object:**
- `_id`: Unit ID
- `unitName`: Unit name in English
- `unitNameKh`: Unit name in Khmer (if available)

**Promotion Object:**
- `_id`: Promotion ID
- `productId`: Reference to product
- `promotionType`: Type of promotion (e.g., "PERCENTAGE", "FIXED")
- `discountValue`: Discount value (percentage or fixed amount)
- `startDate`: Promotion start date
- `endDate`: Promotion end date
- `isActive`: Whether promotion is currently active
- `isDeleted`: Soft delete flag

---

### 2. Get Products for Mobile (Infinity Scroll)

Optimized endpoint for mobile apps with pagination using path parameters.

**Endpoint:**
```
GET /mobile/product/get/skip/:skip/limit/:limit
```

**Authentication:** ❌ Not Required

**URL Parameters:**
- `skip` (required): Number of records to skip
- `limit` (required): Number of records to return

**Example Requests:**
```
GET /mobile/product/get/skip/0/limit/20
GET /mobile/product/get/skip/20/limit/20
GET /mobile/product/get/skip/40/limit/20
```

**Response:** Same format as "Get All Products" above

**Usage Pattern for Infinite Scroll:**
```javascript
// First load
GET /mobile/product/get/skip/0/limit/20

// Load more (second page)
GET /mobile/product/get/skip/20/limit/20

// Load more (third page)
GET /mobile/product/get/skip/40/limit/20
```

**See Also:** [INFINITY_SCROLL_GUIDE.md](../INFINITY_SCROLL_GUIDE.md) for implementation details

---

### 3. Get Single Product by ID

Get detailed information about a specific product.

**Endpoint:**
```
GET /product/get/:id
```

**Authentication:** ❌ Not Required

**URL Parameters:**
- `id` (required): Product ID

**Example Request:**
```
GET /product/get/64a5f8c9e4b0d123456789bb
```

**Response:** Same format as individual product in "Get All Products"

---

### 4. Get Products by Category

Get all products belonging to a specific category.

**Endpoint:**
```
GET /category/product/get/:id
```

**Authentication:** ❌ Not Required

**URL Parameters:**
- `id` (required): Category ID

**Example Request:**
```
GET /category/product/get/64a5f8c9e4b0d1234567890a
```

**Response:** Same format as "Get All Products"

---

### 5. Get Best Selling Products

Get products sorted by sales performance.

**Endpoint:**
```
GET /product/best-sell
```

**Authentication:** ❌ Not Required

**Response:** Same format as "Get All Products" but sorted by sales

---

### 6. Get Promotion Products

Get all products that have active promotions.

**Endpoint:**
```
GET /promotion/products
```

**Authentication:** ❌ Not Required

**Response:**
```json
{
  "message": "get successful",
  "data": [
    {
      "_id": "64a5f8c9e4b0d123456789hh",
      "productId": {
        "_id": "64a5f8c9e4b0d123456789bb",
        "productName": "Fresh Tomatoes",
        "images": ["https://example.com/tomato1.jpg"],
        "categoryId": "64a5f8c9e4b0d1234567890a"
      },
      "promotionType": "PERCENTAGE",
      "discountValue": 10,
      "promotionName": "New Year Sale",
      "description": "Save 10% on fresh tomatoes",
      "startDate": "2024-01-01T00:00:00.000Z",
      "endDate": "2024-01-31T23:59:59.000Z",
      "isActive": true,
      "isDeleted": false,
      "createdAt": "2023-12-15T10:30:00.000Z",
      "updatedAt": "2023-12-15T10:30:00.000Z"
    }
  ]
}
```

---

## Authentication

### Public Endpoints (No Authentication Required)
- `GET /category/get`
- `GET /supplier-categories`
- `GET /supplier-category/:id`
- `GET /product/get`
- `GET /mobile/product/get/skip/:skip/limit/:limit`
- `GET /product/get/:id`
- `GET /category/product/get/:id`
- `GET /product/best-sell`
- `GET /promotion/products`

### Protected Endpoints (Authentication Required)
For endpoints that require authentication, include the JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

---

## Error Responses

### Common Error Formats

**400 Bad Request:**
```json
{
  "message": "Invalid request parameters"
}
```

**404 Not Found:**
```json
{
  "message": "Resource not found"
}
```

**500 Internal Server Error:**
```json
{
  "message": "Internal server error details"
}
```

### HTTP Status Codes
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `404`: Not Found
- `409`: Conflict (e.g., duplicate entry)
- `500`: Internal Server Error

---

## Frontend Implementation Examples

### React/JavaScript Example

#### Fetch Categories
```javascript
const fetchCategories = async () => {
  try {
    const response = await fetch('https://api.example.com/supplier-categories');
    const result = await response.json();
    
    if (response.ok) {
      console.log('Categories:', result.data);
      return result.data;
    }
  } catch (error) {
    console.error('Error fetching categories:', error);
  }
};
```

#### Fetch Products with Pagination
```javascript
const fetchProducts = async (skip = 0, limit = 20, categoryId = null) => {
  try {
    let url = `https://api.example.com/product/get?skip=${skip}&limit=${limit}`;
    if (categoryId) {
      url += `&categoryId=${categoryId}`;
    }
    
    const response = await fetch(url);
    const result = await response.json();
    
    if (response.ok) {
      console.log(`Total products: ${result.total}`);
      console.log('Products:', result.data);
      return result;
    }
  } catch (error) {
    console.error('Error fetching products:', error);
  }
};
```

#### Infinite Scroll for Mobile
```javascript
const fetchProductsInfinite = async (skip = 0, limit = 20) => {
  try {
    const url = `https://api.example.com/mobile/product/get/skip/${skip}/limit/${limit}`;
    const response = await fetch(url);
    const result = await response.json();
    
    if (response.ok) {
      return result.data;
    }
  } catch (error) {
    console.error('Error fetching products:', error);
  }
};

// Usage in infinite scroll
let currentSkip = 0;
const limit = 20;

const loadMore = async () => {
  const products = await fetchProductsInfinite(currentSkip, limit);
  // Append products to your list
  currentSkip += limit;
};
```

#### Search Products by Name
```javascript
const searchProducts = async (searchTerm) => {
  try {
    const url = `https://api.example.com/product/get?productName=${encodeURIComponent(searchTerm)}`;
    const response = await fetch(url);
    const result = await response.json();
    
    if (response.ok) {
      return result.data;
    }
  } catch (error) {
    console.error('Error searching products:', error);
  }
};
```

---

## Notes

1. **No Version Prefix**: This API does not use version prefixes like `/v6/`. All endpoints start directly after the base URL.

2. **Pagination**: When using pagination, the `total` field in the response indicates the total number of records available, which is useful for calculating total pages.

3. **Image URLs**: All image URLs in the response are complete URLs ready to be used in `<img>` tags or React Image components.

4. **Price Format**: Prices are typically in the smallest currency unit (e.g., cents, riel). Divide by 100 for display if needed.

5. **Soft Deletes**: The API uses soft deletes. Deleted items have `isDeleted: true` and are automatically filtered out from responses.

6. **Population**: Related data (categories, suppliers, units, sellers) are automatically populated in product responses, reducing the need for additional API calls.

7. **Case-Insensitive Search**: Product name searches are case-insensitive and support partial matches.

8. **Promotions**: Check `promotionIsActive` flag to quickly determine if a product has active promotions. Full promotion details are in `promotionDetail` array.

---

## Support

For API issues or questions, please contact the backend team or refer to the source code repository.

**API Version:** 2.0.1  
**Last Updated:** December 31, 2025

