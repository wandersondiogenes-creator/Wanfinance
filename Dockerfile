# Use official Node.js 20 LTS slim image as base
FROM node:20-slim AS builder

WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install dependencies including devDependencies for build
RUN npm ci --legacy-peer-deps

# Copy source files
COPY . .

# Build Vite frontend and bundled Express server (dist/server.cjs)
RUN npm run build

# Runner stage for lightweight Cloud Run container
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy node_modules and compiled build outputs
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Expose container port
EXPOSE 3000

# Start server
CMD ["node", "dist/server.cjs"]
