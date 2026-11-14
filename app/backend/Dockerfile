# Prototipe; belum diuji (Docker tidak ada di box dev).
FROM php:8.4-cli
RUN apt-get update && apt-get install -y --no-install-recommends unzip \
 && docker-php-ext-install pdo_mysql \
 && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --no-interaction --prefer-dist
COPY . .
RUN composer dump-autoload --optimize --no-dev \
 && chown -R www-data:www-data storage bootstrap/cache
USER www-data
EXPOSE 8000
