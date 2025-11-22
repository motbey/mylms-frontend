# Dockerfile for MyLMS (frontend + SCORM backend) on Cloud Run

# --- Build stage: build the React/Vite frontend ---
FROM node:20-alpine AS build

# Set working directory
WORKDIR /app

# Copy package manifests and install all deps (including dev deps)
COPY package*.json ./
RUN npm install

# Copy the rest of the source code
COPY . .

# Build the frontend (this should create a "dist" folder)
RUN npm run build

# --- Runtime stage: lightweight image to serve app + SCORM proxy ---
FROM node:20-alpine

WORKDIR /app

# Copy only production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy built frontend from the build stage
COPY --from=build /app/dist ./dist

# Copy server code
COPY server.js ./server.js

# Environment
ENV NODE_ENV=production

# Cloud Run expects the container to listen on $PORT (default 8080)
EXPOSE 8080

# Start the Express server
CMD ["node", "server.js"]
