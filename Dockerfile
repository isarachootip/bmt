FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates libstdc++6 \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .

ARG DATABASE_URL="postgresql://placeholder:placeholder@127.0.0.1:5432/bmt_db?schema=public"
RUN DATABASE_URL="${DATABASE_URL}" npm run build \
  && mkdir -p /app/.pgdata

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

CMD ["npm", "run", "start"]
