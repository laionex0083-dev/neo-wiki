FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# 데이터 디렉토리 생성
RUN mkdir -p data uploads

EXPOSE 3001

CMD ["node", "src/app.js"]
