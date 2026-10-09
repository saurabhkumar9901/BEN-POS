#!/bin/sh
# Mount the Azure Files share (or local bind) at /mnt/share, then link the
# app's data dirs at it. Works identically with no mount (plain local dirs).
set -e
mkdir -p /mnt/share/data /mnt/share/processed
rmdir /app/data /app/processed 2>/dev/null || true
ln -sfnT /mnt/share/data /app/data
ln -sfnT /mnt/share/processed /app/processed
exec node server.js
