FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

RUN node_modules/.bin/prisma generate

COPY . .

EXPOSE 4000

CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node src/index.js"]
