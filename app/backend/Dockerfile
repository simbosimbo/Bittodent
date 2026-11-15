# Image backend staging-like: php-fpm 8.4 (port 9000, FastCGI). DATA PALSU SAJA (D-030).
# Satu image untuk empat peran di docker-compose: backend (php-fpm), migrate, queue (queue:work), scheduler (schedule:work).
# HTTP dilayani nginx di image frontend (fastcgi_pass backend:9000), jadi SPA + API satu origin.
# Tidak ada rahasia di image: APP_KEY, ENCRYPTION_KEY, BLIND_INDEX_KEY, kata sandi DB datang dari env saat container jalan.
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --no-interaction --prefer-dist --ignore-platform-reqs

FROM php:8.4-fpm
# pdo_mysql (MySQL 8.4), bcmath/intl (angka & format), zip (impor spreadsheet ICD), pcntl (queue:work berhenti rapi), opcache.
# mbstring, ctype, tokenizer, xml, dom, json, fileinfo, sodium sudah ada di image resmi.
RUN apt-get update && apt-get install -y --no-install-recommends libicu-dev libzip-dev unzip \
 && docker-php-ext-install -j"$(nproc)" pdo_mysql bcmath intl zip pcntl opcache \
 && rm -rf /var/lib/apt/lists/* \
 && mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"
COPY docker/php.ini "$PHP_INI_DIR/conf.d/zz-ehr.ini"
COPY docker/fpm.conf /usr/local/etc/php-fpm.d/zz-ehr.conf
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /app
COPY --from=vendor /app/vendor ./vendor
COPY . .
RUN composer dump-autoload --optimize --no-dev --classmap-authoritative \
 && php artisan package:discover --ansi \
 && mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
 && chown -R www-data:www-data storage bootstrap/cache
USER www-data
EXPOSE 9000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD php -r 'exit(@fsockopen("127.0.0.1", 9000) ? 0 : 1);'
CMD ["php-fpm"]
