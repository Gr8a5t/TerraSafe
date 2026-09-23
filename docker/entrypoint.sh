#!/bin/sh
set -e

# Ensure SQLite file and directory exist with proper permissions
mkdir -p /var/www/html/database
if [ ! -f /var/www/html/database/database.sqlite ]; then
    touch /var/www/html/database/database.sqlite
fi
chown -R www-data:www-data /var/www/html/database
chmod -R 775 /var/www/html/database

# Ensure storage and bootstrap/cache permissions
mkdir -p /var/www/html/storage /var/www/html/bootstrap/cache
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache
chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache

# Run database migrations
php /var/www/html/artisan migrate --force

# Generate wayfinder routes if command exists
php /var/www/html/artisan wayfinder:generate --quiet || true

# Optimize Laravel cache
php /var/www/html/artisan config:cache
php /var/www/html/artisan route:cache
php /var/www/html/artisan view:cache
