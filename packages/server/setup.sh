#!/bin/bash

# Setup script for Wenyan Server

echo "🚀 Setting up Wenyan Server..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if Wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "🔧 Installing Wrangler CLI..."
    npm install -g @cloudflare/wrangler
fi

echo "✅ Wrangler $(wrangler --version) detected"

# Prompt for Cloudflare login
echo "🔐 Please login to Cloudflare:"
wrangler login

# Ask if user wants to set up environment variables
read -p "Do you want to set up environment variables now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔑 Setting up environment variables..."
    
    # Add your environment variables here
    echo "Example: wrangler secret put OPENAI_API_KEY"
    echo "Example: wrangler secret put ANTHROPIC_API_KEY"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Run 'npm run dev' to start the development server"
echo "2. Visit http://localhost:8787/health to check the API"
echo "3. Read README.md for more information"
echo ""
echo "Happy coding! 🚀"