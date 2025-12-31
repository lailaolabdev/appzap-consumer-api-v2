#!/bin/bash

# AppZap Consumer API Startup Script
# This script helps you start the API with proper checks

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║   🚀 AppZap Consumer API - Startup Script                ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "   Please copy .env.example to .env and configure it"
    echo ""
    echo "   Run: cp .env.example .env"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Error: Node.js 20.x or higher is required"
    echo "   Current version: $(node -v)"
    exit 1
fi

echo "✓ Node.js version: $(node -v)"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 Installing dependencies..."
    npm install
    echo "✓ Dependencies installed"
fi

# Ask user how to start
echo ""
echo "How do you want to start the API?"
echo ""
echo "  1) Development mode (with auto-reload)"
echo "  2) Production mode (Docker Compose)"
echo "  3) Production mode (Build & Start)"
echo "  4) Run database migrations only"
echo ""
read -p "Enter choice [1-4]: " choice

case $choice in
    1)
        echo ""
        echo "Starting in development mode..."
        npm run dev
        ;;
    2)
        echo ""
        echo "Starting with Docker Compose..."
        if ! command -v docker-compose &> /dev/null; then
            echo "❌ Error: docker-compose is not installed"
            exit 1
        fi
        docker-compose up -d
        echo ""
        echo "✓ Services started"
        echo ""
        echo "View logs: docker-compose logs -f api"
        echo "Stop services: docker-compose down"
        ;;
    3)
        echo ""
        echo "Building TypeScript..."
        npm run build
        echo "✓ Build complete"
        echo ""
        echo "Starting production server..."
        npm start
        ;;
    4)
        echo ""
        echo "Running database migrations..."
        npm run migrate
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac


