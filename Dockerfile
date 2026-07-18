FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/db/schema.sql ./src/db/schema.sql

EXPOSE 3000
# Runs migrations right before starting the application
CMD ["sh", "-c", "npm run migrate && npm start"]