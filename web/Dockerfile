FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
# next.config.mjs sets output:"export" — the build emits a static site in out/,
# not .next/standalone. Serve it with nginx.
RUN npm run build

FROM nginx:alpine AS runner
COPY --from=builder /app/out /usr/share/nginx/html

EXPOSE 80
