# Multi-stage Dockerfile for Poker Club server
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 8080
# Environment: DATABASE_URL, REDIS_URL, PORT
CMD ["node", "src/index.js"]
