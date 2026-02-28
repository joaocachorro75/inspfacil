# Stage 1: Build
FROM node:22-bookworm AS builder

WORKDIR /app

# Install build dependencies for native modules (like better-sqlite3)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm install

# Copy source code
COPY . .

# Build the frontend
RUN npm run build

# Stage 2: Runtime
FROM node:22-bookworm-slim AS runner

WORKDIR /app

# Install runtime dependencies for better-sqlite3 (if any, usually slim is fine but might need libsqlite3)
# better-sqlite3 bundles its own sqlite3, but might need some libs
RUN apt-get update && apt-get install -y \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Copy built assets and server code
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Expose the port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start the application directly with node to handle signals better
CMD ["node", "--experimental-strip-types", "server.ts"]
