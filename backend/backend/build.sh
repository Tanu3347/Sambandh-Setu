#!/usr/bin/env bash
# Exit immediately if a command exits with a non-zero status
set -o errexit

echo "=========================================="
echo "  Sambandh Setu Backend - Production Build"
echo "=========================================="

echo "===> Installing dependencies..."
npm ci || npm install

echo "===> Initializing database and running seed if needed..."
node seed/seedUsers.js || echo "Database seed completed or skipped."

echo "===> Backend build completed successfully!"
