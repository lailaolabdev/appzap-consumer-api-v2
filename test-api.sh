#!/bin/bash

# AppZap Consumer API - Quick Test Script
# This script tests the Eats product endpoints

BASE_URL="http://localhost:9000"
API_V1="$BASE_URL/api/v1"

echo "🚀 AppZap Consumer API - Test Script"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_test() {
    echo -e "${BLUE}TEST:${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# 1. Health Check
print_test "Health Check"
response=$(curl -s "$BASE_URL/health")
if [[ $response == *"healthy"* ]]; then
    print_success "Server is healthy"
else
    print_error "Server health check failed"
    exit 1
fi
echo ""

# 2. Request OTP
print_test "Request OTP"
phone="8562093352677"
echo "Phone: $phone"
otp_response=$(curl -s -X POST "$API_V1/auth/request-otp" \
    -H "Content-Type: application/json" \
    -d "{\"phone\": \"$phone\"}")
echo $otp_response | jq '.'
print_success "OTP requested"
echo ""

# Prompt for OTP
echo -e "${YELLOW}Please enter the OTP code:${NC}"
read otp_code

# 3. Verify OTP and get token
print_test "Verify OTP"
auth_response=$(curl -s -X POST "$API_V1/auth/verify-otp" \
    -H "Content-Type: application/json" \
    -d "{\"phone\": \"$phone\", \"otp\": \"$otp_code\"}")
echo $auth_response | jq '.'

# Extract token
ACCESS_TOKEN=$(echo $auth_response | jq -r '.accessToken')
if [ "$ACCESS_TOKEN" == "null" ] || [ -z "$ACCESS_TOKEN" ]; then
    print_error "Failed to get access token"
    exit 1
fi
print_success "Authenticated successfully"
echo "Access Token: ${ACCESS_TOKEN:0:50}..."
echo ""

# 4. Get User Profile
print_test "Get User Profile"
curl -s -X GET "$API_V1/auth/me" \
    -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
print_success "User profile retrieved"
echo ""

# 5. Get Restaurants
print_test "Get Restaurants"
restaurants=$(curl -s -X GET "$API_V1/eats/restaurants?limit=5" | jq '.')
echo $restaurants | jq '.data[0:2]'
RESTAURANT_ID=$(echo $restaurants | jq -r '.data[0].id // "rest001"')
print_success "Restaurants retrieved"
echo "Using Restaurant ID: $RESTAURANT_ID"
echo ""

# 6. Get Restaurant Details
print_test "Get Restaurant Details"
curl -s -X GET "$API_V1/eats/restaurants/$RESTAURANT_ID" | jq '.'
print_success "Restaurant details retrieved"
echo ""

# 7. Create Cart
print_test "Create Cart"
cart_response=$(curl -s -X POST "$API_V1/eats/cart" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
        \"restaurantId\": \"$RESTAURANT_ID\",
        \"orderType\": \"dine_in\",
        \"tableId\": \"T5\"
    }")
echo $cart_response | jq '.'
CART_ID=$(echo $cart_response | jq -r '.cartId')
print_success "Cart created"
echo "Cart ID: $CART_ID"
echo ""

# 8. Add Item to Cart
print_test "Add Item to Cart"
curl -s -X POST "$API_V1/eats/cart/$CART_ID/items" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "menuItemId": "item001",
        "name": "Pad Thai",
        "price": 35000,
        "quantity": 2,
        "modifiers": [
            {
                "id": "mod001",
                "name": "Extra Spicy",
                "price": 0
            }
        ],
        "specialInstructions": "No peanuts please"
    }' | jq '.'
print_success "Item added to cart"
echo ""

# 9. Add Another Item
print_test "Add Another Item to Cart"
curl -s -X POST "$API_V1/eats/cart/$CART_ID/items" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "menuItemId": "item002",
        "name": "Tom Yum Soup",
        "price": 45000,
        "quantity": 1
    }' | jq '.'
print_success "Another item added"
echo ""

# 10. Get Loyalty Balance
print_test "Get Loyalty Balance"
curl -s -X GET "$API_V1/auth/me" \
    -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.points'
print_success "Loyalty balance retrieved"
echo ""

# 11. Checkout (without actual payment)
print_test "Checkout Cart"
echo -e "${YELLOW}Skipping actual checkout to avoid payment processing${NC}"
echo "You can manually test checkout with:"
echo "curl -X POST $API_V1/eats/cart/$CART_ID/checkout \\"
echo "  -H \"Authorization: Bearer $ACCESS_TOKEN\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"paymentMethod\": \"phapay\", \"tipAmount\": 5000}'"
echo ""

# 12. Get Orders
print_test "Get User Orders"
curl -s -X GET "$API_V1/eats/orders?limit=5" \
    -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
print_success "Orders retrieved"
echo ""

# 13. Check Booking Availability
print_test "Check Table Availability"
tomorrow=$(date -v+1d +%Y-%m-%d 2>/dev/null || date -d "+1 day" +%Y-%m-%d)
curl -s -X GET "$API_V1/eats/bookings/availability?restaurantId=$RESTAURANT_ID&date=$tomorrow&guests=4" | jq '.'
print_success "Availability checked"
echo ""

echo ""
echo -e "${GREEN}════════════════════════════════════${NC}"
echo -e "${GREEN}✓ All tests completed successfully!${NC}"
echo -e "${GREEN}════════════════════════════════════${NC}"
echo ""
echo "Your Access Token (save this for further testing):"
echo "$ACCESS_TOKEN"
echo ""
echo "Cart ID: $CART_ID"
echo "Restaurant ID: $RESTAURANT_ID"
echo ""
echo "Next steps:"
echo "1. Test WebSocket connection (see PHASE2_COMPLETE.md)"
echo "2. Test checkout flow with payment"
echo "3. Test order tracking"
echo "4. Create reservations"
echo ""

