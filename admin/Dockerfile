# Админ кабинет «Мой тёплый дом» — контейнер для любого хостинга (Amvera, Timeweb Cloud, Yandex Cloud, VPS).
# Настройки — переменные окружения, список в server/index.js и ЗАПУСК.md.
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=10000 WORK_DIR=/tmp/mtd-admin
EXPOSE 10000
CMD ["node", "server/index.js"]
