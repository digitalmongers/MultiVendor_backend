# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
# Install ALL dependencies (including dev) to run build scripts if needed
RUN npm ci

COPY . .

# Production Stage
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

# Install ONLY production dependencies and clean cache
RUN npm ci --only=production && npm cache clean --force

# Copy source code and necessary files
COPY --from=builder /app/src ./src
COPY --from=builder /app/server.js ./
COPY --from=builder /app/instrument.js ./

EXPOSE 5000

CMD ["node", "--import", "./instrument.js", "server.js"]
