# Multi-stage Dockerfile for Poker Club server
FROM node:20-alpine AS deps
WORKDIR /app

# Add build tools for native modules (bcrypt, canvas, sharp, pg-native, etc.)
RUN apk add --no-cache --virtual .gyp python3 make g++ pkgconfig

# Copy only manifests first (better caching)
COPY package*.json ./

# Use npm ci when lockfile exists; fall back to npm install otherwise
# Also skip audit/fund noise
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev --no-audit --no-fund; \
    else \
      npm install --omit=dev --no-audit --no-fund; \
    fi

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy the rest of the server code
COPY . .

EXPOSE 8080
CMD ["node", "src/index.js"]
