#!/bin/sh
set -e

mkdir -p "${PNO_DATA_DIR:-/data}"

# Apply SQLite schema on first boot and after upgrades.
if [ -f drizzle.config.ts ]; then
  ./node_modules/.bin/drizzle-kit push
fi

exec "$@"
