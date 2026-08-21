FROM node:20-alpine AS builder
WORKDIR /app

# Install backend dependencies & build
COPY backend/package.json backend/package-lock.json ./backend/
WORKDIR /app/backend
RUN npm ci
COPY backend ./
RUN npm run build

# Install frontend dependencies & build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . ./
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/backend/package.json ./backend/
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/.next ./backend/.next
COPY --from=builder /app/backend/public ./backend/public

EXPOSE 3000
WORKDIR /app/backend
CMD ["npm", "start"]
