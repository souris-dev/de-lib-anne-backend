FROM node:14-alpine
WORKDIR /usr/src/services/wishlist
COPY package.json package-lock.json ./
RUN npm install --production
COPY . .
EXPOSE 5001
CMD ["node", "./main.js", "&"]
