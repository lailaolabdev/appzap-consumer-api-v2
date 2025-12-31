#!/bin/bash

###############################################################################
# AppZap Consumer API - Comprehensive Testing Script
# Tests all API endpoints to ensure production readiness
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:9000}"
PHONE="${TEST_PHONE:-8562012345678}"
OTP_CODE="${TEST_OTP:-123456}"

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Store tokens and IDs
ACCESS_TOKEN=""
REFRESH_TOKEN=""
USER_ID=""
CART_ID=""
ORDER_ID=""
RESTAURANT_ID=""
DELIVERY_ADDRESS_ID=""
MEAL_PLAN_ID=""
SUPPLEMENT_ID=""
SUBSCRIPTION_ID=""
MARKET_ORDER_ID=""
DEEP_LINK_CODE=""
REWARD_ID=""

###############################################################################
# Helper Functions
###############################################################################

print_header() {
    echo -e "\n${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC} ${BLUE}$1${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}\n"
}

print_test() {
    echo -e "${YELLOW}→${NC} Testing: $1"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
    PASSED_TESTS=$((PASSED_TESTS + 1))
}

print_error() {
    echo -e "${RED}✗${NC} $1"
    FAILED_TESTS=$((FAILED_TESTS + 1))
}

print_info() {
    echo -e "${PURPLE}ℹ${NC} $1"
}

make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local headers=$4
    
    if [ -n "$data" ]; then
        curl -s -X "$method" "$API_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "$headers" \
            -d "$data"
    else
        curl -s -X "$method" "$API_URL$endpoint" \
            -H "$headers"
    fi
}

check_response() {
    local response=$1
    local expected_field=$2
    
    if echo "$response" | jq -e "$expected_field" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

###############################################################################
# Test Suite
###############################################################################

print_header "🚀 AppZap Consumer API - Comprehensive Test Suite"
echo -e "${BLUE}API URL:${NC} $API_URL"
echo -e "${BLUE}Test Phone:${NC} $PHONE"
echo -e "${BLUE}Started:${NC} $(date)"

###############################################################################
# Phase 0: Health Check
###############################################################################

print_header "Phase 0: Health Check"

print_test "GET /health"
response=$(curl -s "$API_URL/health")
if check_response "$response" ".status" && [[ "$response" == *"healthy"* ]]; then
    print_success "Health check passed"
else
    print_error "Health check failed: $response"
fi

print_test "GET /health/detailed"
response=$(curl -s "$API_URL/health/detailed")
if check_response "$response" ".mongodb.status"; then
    print_success "Detailed health check passed"
    print_info "MongoDB: $(echo $response | jq -r '.mongodb.status')"
    print_info "Redis: $(echo $response | jq -r '.redis.status')"
else
    print_error "Detailed health check failed"
fi

###############################################################################
# Phase 1: Authentication
###############################################################################

print_header "Phase 1: Authentication"

print_test "POST /api/v1/auth/otp/request"
response=$(make_request "POST" "/api/v1/auth/otp/request" "{\"phone\":\"$PHONE\"}")
if check_response "$response" ".success"; then
    print_success "OTP request sent"
else
    print_error "OTP request failed: $response"
fi

print_test "POST /api/v1/auth/otp/verify"
response=$(make_request "POST" "/api/v1/auth/otp/verify" "{\"phone\":\"$PHONE\",\"otp\":\"$OTP_CODE\"}")
if check_response "$response" ".accessToken"; then
    ACCESS_TOKEN=$(echo "$response" | jq -r '.accessToken')
    REFRESH_TOKEN=$(echo "$response" | jq -r '.refreshToken')
    USER_ID=$(echo "$response" | jq -r '.user._id')
    print_success "OTP verified - Token obtained"
    print_info "User ID: $USER_ID"
else
    print_error "OTP verification failed: $response"
    exit 1
fi

print_test "GET /api/v1/auth/profile"
response=$(make_request "GET" "/api/v1/auth/profile" "" "Authorization: Bearer $ACCESS_TOKEN")
if check_response "$response" "._id"; then
    print_success "Profile retrieved"
else
    print_error "Profile retrieval failed: $response"
fi

print_test "POST /api/v1/auth/refresh"
response=$(make_request "POST" "/api/v1/auth/refresh" "{\"refreshToken\":\"$REFRESH_TOKEN\"}")
if check_response "$response" ".accessToken"; then
    print_success "Token refreshed"
else
    print_error "Token refresh failed: $response"
fi

###############################################################################
# Phase 2: Eats Product
###############################################################################

print_header "Phase 2: Eats Product"

print_test "GET /api/v1/eats/restaurants"
response=$(make_request "GET" "/api/v1/eats/restaurants?page=1&limit=5")
if check_response "$response" ".data"; then
    RESTAURANT_ID=$(echo "$response" | jq -r '.data[0]._id // empty')
    print_success "Restaurants retrieved"
    if [ -n "$RESTAURANT_ID" ]; then
        print_info "Restaurant ID: $RESTAURANT_ID"
    fi
else
    print_error "Restaurant retrieval failed: $response"
fi

if [ -n "$RESTAURANT_ID" ]; then
    print_test "GET /api/v1/eats/restaurants/:id"
    response=$(make_request "GET" "/api/v1/eats/restaurants/$RESTAURANT_ID")
    if check_response "$response" "._id"; then
        print_success "Restaurant details retrieved"
    else
        print_error "Restaurant details failed: $response"
    fi
    
    print_test "POST /api/v1/eats/cart"
    response=$(make_request "POST" "/api/v1/eats/cart" \
        "{\"restaurantId\":\"$RESTAURANT_ID\",\"orderType\":\"takeaway\"}" \
        "Authorization: Bearer $ACCESS_TOKEN")
    if check_response "$response" ".cartId"; then
        CART_ID=$(echo "$response" | jq -r '.cartId')
        print_success "Cart created"
        print_info "Cart ID: $CART_ID"
    else
        print_error "Cart creation failed: $response"
    fi
else
    print_info "Skipping cart tests - no restaurant available"
fi

if [ -n "$CART_ID" ]; then
    print_test "GET /api/v1/eats/cart/:id"
    response=$(make_request "GET" "/api/v1/eats/cart/$CART_ID" "" "Authorization: Bearer $ACCESS_TOKEN")
    if check_response "$response" "._id"; then
        print_success "Cart retrieved"
    else
        print_error "Cart retrieval failed: $response"
    fi
fi

print_test "GET /api/v1/eats/orders"
response=$(make_request "GET" "/api/v1/eats/orders" "" "Authorization: Bearer $ACCESS_TOKEN")
if check_response "$response" ".data"; then
    print_success "Orders retrieved"
else
    print_error "Orders retrieval failed: $response"
fi

###############################################################################
# Phase 3: Market Product
###############################################################################

print_header "Phase 3: Market Product"

print_test "GET /api/v1/market/products"
response=$(make_request "GET" "/api/v1/market/products?page=1&limit=5")
if check_response "$response" ".data"; then
    print_success "Products retrieved"
else
    print_error "Products retrieval failed: $response"
fi

print_test "GET /api/v1/market/categories"
response=$(make_request "GET" "/api/v1/market/categories")
if check_response "$response" "."; then
    print_success "Categories retrieved"
else
    print_error "Categories retrieval failed: $response"
fi

print_test "GET /api/v1/market/addresses"
response=$(make_request "GET" "/api/v1/market/addresses" "" "Authorization: Bearer $ACCESS_TOKEN")
if check_response "$response" ".data"; then
    print_success "Delivery addresses retrieved"
    DELIVERY_ADDRESS_ID=$(echo "$response" | jq -r '.data[0]._id // empty')
else
    print_error "Delivery addresses retrieval failed: $response"
fi

if [ -z "$DELIVERY_ADDRESS_ID" ]; then
    print_test "POST /api/v1/market/addresses"
    response=$(make_request "POST" "/api/v1/market/addresses" \
        "{\"label\":\"Test Home\",\"recipientName\":\"Test User\",\"phone\":\"$PHONE\",\"addressLine1\":\"123 Test St\",\"district\":\"Chanthabouly\",\"city\":\"Vientiane\",\"province\":\"Vientiane Capital\",\"latitude\":17.9757,\"longitude\":102.6331}" \
        "Authorization: Bearer $ACCESS_TOKEN")
    if check_response "$response" ".addressId"; then
        DELIVERY_ADDRESS_ID=$(echo "$response" | jq -r '.addressId')
        print_success "Delivery address created"
        print_info "Address ID: $DELIVERY_ADDRESS_ID"
    else
        print_error "Delivery address creation failed: $response"
    fi
fi

print_test "GET /api/v1/market/orders"
response=$(make_request "GET" "/api/v1/market/orders" "" "Authorization: Bearer $ACCESS_TOKEN")
if check_response "$response" ".data"; then
    print_success "Market orders retrieved"
else
    print_error "Market orders retrieval failed: $response"
fi

print_test "GET /api/v1/market/subscriptions"
response=$(make_request "GET" "/api/v1/market/subscriptions" "" "Authorization: Bearer $ACCESS_TOKEN")
if check_response "$response" ".data"; then
    print_success "Subscriptions retrieved"
else
    print_error "Subscriptions retrieval failed: $response"
fi

###############################################################################
# Phase 4: Identity Linking
###############################################################################

print_header "Phase 4: Identity Linking"

print_test "GET /api/v1/identity/profile-context"
response=$(make_request "GET" "/api/v1/identity/profile-context" "" "Authorization: Bearer $ACCESS_TOKEN")
if check_response "$response" ".profileType"; then
    print_success "Profile context retrieved"
    print_info "Profile Type: $(echo $response | jq -r '.profileType')"
    print_info "Price Type: $(echo $response | jq -r '.priceType')"
else
    print_error "Profile context retrieval failed: $response"
fi

###############################################################################
# Phase 5: Live Product
###############################################################################

print_header "Phase 5: Live Product (Health & Meals)"

print_test "GET /api/v1/live/health-profile"
response=$(make_request "GET" "/api/v1/live/health-profile" "" "Authorization: Bearer $ACCESS_TOKEN")
if check_response "$response" ".userId"; then
    print_success "Health profile retrieved"
else
    print_error "Health profile retrieval failed: $response"
fi

print_test "PUT /api/v1/live/health-profile"
response=$(make_request "PUT" "/api/v1/live/health-profile" \
    "{\"age\":30,\"gender\":\"male\",\"height\":175,\"weight\":75,\"dietaryRestrictions\":[\"vegetarian\"],\"healthGoals\":[{\"type\":\"weight_loss\",\"priority\":5}]}" \
    "Authorization: Bearer $ACCESS_TOKEN")
if check_response "$response" ".success"; then
    print_success "Health profile updated"
else
    print_error "Health profile update failed: $response"
fi

print_test "GET /api/v1/live/meal-plans"
response=$(make_request "GET" "/api/v1/live/meal-plans?page=1&limit=5")
if check_response "$response" ".data"; then
    MEAL_PLAN_ID=$(echo "$response" | jq -r '.data[0]._id // empty')
    print_success "Meal plans retrieved"
    if [ -n "$MEAL_PLAN_ID" ]; then
        print_info "Meal Plan ID: $MEAL_PLAN_ID"
    fi
else
    print_error "Meal plans retrieval failed: $response"
fi

if [ -n "$MEAL_PLAN_ID" ]; then
    print_test "GET /api/v1/live/meal-plans/:id"
    response=$(make_request "GET" "/api/v1/live/meal-plans/$MEAL_PLAN_ID")
    if check_response "$response" "._id"; then
        print_success "Meal plan details retrieved"
        print_info "Compatible: $(echo $response | jq -r '.isCompatible')"
    else
        print_error "Meal plan details failed: $response"
    fi
fi

print_test "GET /api/v1/live/supplements"
response=$(make_request "GET" "/api/v1/live/supplements?page=1&limit=5")
if check_response "$response" ".data"; then
    SUPPLEMENT_ID=$(echo "$response" | jq -r '.data[0]._id // empty')
    print_success "Supplements retrieved"
    if [ -n "$SUPPLEMENT_ID" ]; then
        print_info "Supplement ID: $SUPPLEMENT_ID"
    fi
else
    print_error "Supplements retrieval failed: $response"
fi

if [ -n "$SUPPLEMENT_ID" ]; then
    print_test "GET /api/v1/live/supplements/:id"
    response=$(make_request "GET" "/api/v1/live/supplements/$SUPPLEMENT_ID")
    if check_response "$response" "._id"; then
        print_success "Supplement details retrieved"
    else
        print_error "Supplement details failed: $response"
    fi
fi

print_test "GET /api/v1/live/subscriptions"
response=$(make_request "GET" "/api/v1/live/subscriptions" "" "Authorization: Bearer $ACCESS_TOKEN")
if check_response "$response" ".data"; then
    print_success "Meal subscriptions retrieved"
else
    print_error "Meal subscriptions retrieval failed: $response"
fi

###############################################################################
# Phase 6: Deep Links & Gamification
###############################################################################

print_header "Phase 6: Deep Links & Gamification"

print_test "GET /api/v1/deep-links/spin-to-win/rewards"
response=$(make_request "GET" "/api/v1/deep-links/spin-to-win/rewards" "" "Authorization: Bearer $ACCESS_TOKEN")
if check_response "$response" ".data"; then
    REWARD_ID=$(echo "$response" | jq -r '.data[0]._id // empty')
    print_success "Spin-to-win rewards retrieved"
    if [ -n "$REWARD_ID" ]; then
        print_info "Reward ID: $REWARD_ID"
    fi
else
    print_error "Rewards retrieval failed: $response"
fi

print_test "GET /api/v1/deep-links/spin-to-win/statistics"
response=$(make_request "GET" "/api/v1/deep-links/spin-to-win/statistics" "" "Authorization: Bearer $ACCESS_TOKEN")
if check_response "$response" ".totalRewards"; then
    print_success "Spin-to-win statistics retrieved"
else
    print_error "Statistics retrieval failed: $response"
fi

###############################################################################
# Phase 7: Notifications
###############################################################################

print_header "Phase 7: Notifications"

print_test "POST /api/v1/notifications/fcm-token"
response=$(make_request "POST" "/api/v1/notifications/fcm-token" \
    "{\"fcmToken\":\"test-fcm-token-12345\"}" \
    "Authorization: Bearer $ACCESS_TOKEN")
if check_response "$response" ".success"; then
    print_success "FCM token updated"
else
    print_error "FCM token update failed: $response"
fi

###############################################################################
# Phase 8: Bookings
###############################################################################

print_header "Phase 8: Bookings"

if [ -n "$RESTAURANT_ID" ]; then
    print_test "GET /api/v1/eats/bookings/availability"
    response=$(make_request "GET" "/api/v1/eats/bookings/availability?restaurantId=$RESTAURANT_ID&date=$(date +%Y-%m-%d)")
    if check_response "$response" "."; then
        print_success "Booking availability retrieved"
    else
        print_error "Booking availability failed: $response"
    fi
fi

print_test "GET /api/v1/eats/bookings/my-bookings"
response=$(make_request "GET" "/api/v1/eats/bookings/my-bookings" "" "Authorization: Bearer $ACCESS_TOKEN")
if check_response "$response" ".data"; then
    print_success "User bookings retrieved"
else
    print_error "User bookings retrieval failed: $response"
fi

###############################################################################
# Summary
###############################################################################

print_header "Test Summary"

echo -e "${BLUE}Total Tests:${NC}   $TOTAL_TESTS"
echo -e "${GREEN}Passed:${NC}        $PASSED_TESTS"
echo -e "${RED}Failed:${NC}        $FAILED_TESTS"

PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
echo -e "${BLUE}Pass Rate:${NC}     $PASS_RATE%"

echo -e "\n${BLUE}Completed:${NC}     $(date)"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}  ${GREEN}✓ ALL TESTS PASSED - API IS PRODUCTION READY!${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}\n"
    exit 0
else
    echo -e "\n${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║${NC}  ${RED}✗ SOME TESTS FAILED - REVIEW ERRORS ABOVE${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}\n"
    exit 1
fi


