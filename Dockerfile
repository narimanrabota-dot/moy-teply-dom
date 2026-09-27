# Админ кабинет «Мой тёплый дом» (Amvera и другие хостинги): собирается из папки admin этой ветки.
# В ветку main этот файл не сливать — см. admin/README.md.
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY admin/package.json admin/package-lock.json ./
RUN npm ci --omit=dev
COPY admin/ .
ENV PORT=10000 WORK_DIR=/tmp/mtd-admin
EXPOSE 10000
CMD ["node", "server/index.js"]
