#!/bin/bash
# Dijalankan sekali oleh image mysql saat volume data masih kosong. Placeholder dev, bukan rahasia asli.
# Sama dengan setup lokal: ehr_admin = migrasi/seed/tes (ALL + GRANT OPTION), ehr_app = runtime tanpa hak;
# hak ehr_app diberikan per tabel oleh migrasi database/migrations/mysql/*_grants_ehr_app.php (DB_APP_GRANT_HOST='%').
set -euo pipefail
mysql --protocol=socket -uroot -p"$MYSQL_ROOT_PASSWORD" <<SQL
CREATE DATABASE IF NOT EXISTS ehr_dev  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS ehr_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS 'ehr_admin'@'%' IDENTIFIED BY '${EHR_ADMIN_PASSWORD}';
CREATE USER IF NOT EXISTS 'ehr_app'@'%'   IDENTIFIED BY '${EHR_APP_PASSWORD}';
GRANT ALL PRIVILEGES ON ehr_dev.*  TO 'ehr_admin'@'%' WITH GRANT OPTION;
GRANT ALL PRIVILEGES ON ehr_test.* TO 'ehr_admin'@'%' WITH GRANT OPTION;
SQL
