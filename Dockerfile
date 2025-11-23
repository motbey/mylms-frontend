# ---------- Build stage ----------
FROM node:20-alpine AS build

# Create app directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the source
COPY . .

# Build the Vite app
RUN npm run build

# ---------- Runtime stage ----------
FROM node:20-alpine AS runtime

WORKDIR /app

# Only install production deps
COPY package*.json ./
RUN npm install --omit=dev

# Copy built frontend and server file
COPY --from=build /app/dist ./dist
COPY server.js ./
COPY index.html ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY types.ts ./

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
