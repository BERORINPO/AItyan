FROM node:20-alpine AS base

# 依存関係インストール
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ビルド
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 本番イメージ
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Next.js standalone出力
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# WebSocketサーバー関連ファイル
COPY --from=builder /app/node_modules/dotenv ./node_modules/dotenv
COPY --from=builder /app/node_modules/google-auth-library ./node_modules/google-auth-library
COPY --from=builder /app/node_modules/gcp-metadata ./node_modules/gcp-metadata
COPY --from=builder /app/node_modules/gaxios ./node_modules/gaxios
COPY --from=builder /app/node_modules/gtoken ./node_modules/gtoken
COPY --from=builder /app/node_modules/ws ./node_modules/ws

# GCPサービスアカウントキー（ビルド時に含める場合）
# COPY able-dryad-485001-t6-187b29554908.json ./credentials/service-account.json

# 起動スクリプト
COPY --from=builder /app/start.sh ./start.sh
RUN chmod +x start.sh

USER nextjs

EXPOSE 3000 3001

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "start.sh"]
