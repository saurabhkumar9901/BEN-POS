# BENPOS desk: Next.js frontend + Python pipeline in one image.
# Data-free (data/ + processed/ are gitignored and mounted at runtime),
# so the image is safe to push to a public registry.
#
#   docker build -t benpos-desk:local .
#   docker compose -f deploy/compose.yml up

# ---------- frontend build ----------
FROM node:24-bookworm-slim AS webbuild
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
# NOTE: `npm install`, not `npm ci` — the lockfile omits some
# platform-optional transitive deps (@emnapi/* via sharp-wasm32) that only
# materialize on linux, and `ci` aborts on the gap. The lock still pins
# everything else, so builds stay reproducible.
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---------- runtime: node + python ----------
FROM node:24-bookworm-slim
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONPATH=/app/src \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    BENPOS_POOL=2
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/* \
    && python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY src/ ./src/
COPY company_map.csv ./
COPY deploy/start.sh /app/start.sh
RUN chmod +x /app/start.sh \
    && mkdir -p /app/data /app/processed /mnt/share
# Next.js standalone server (+ static assets it doesn't bundle)
COPY --from=webbuild /build/frontend/.next/standalone /app/web
COPY --from=webbuild /build/frontend/public /app/web/public
COPY --from=webbuild /build/frontend/.next/static /app/web/.next/static
# Turbopack's trace copies duckdb.node but drops its sibling libduckdb.so:
# restore it and put it on the loader path.
COPY --from=webbuild /build/frontend/node_modules/@duckdb/node-bindings-linux-x64/libduckdb.so /app/web/node_modules/@duckdb/node-bindings-linux-x64/
ENV LD_LIBRARY_PATH="/app/web/node_modules/@duckdb/node-bindings-linux-x64"
WORKDIR /app/web
EXPOSE 3000
CMD ["sh", "/app/start.sh"]
