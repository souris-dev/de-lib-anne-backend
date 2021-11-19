FROM node:14-alpine
WORKDIR /usr/src/services/auth
COPY package.json package-lock.json ./
RUN npm install --production
COPY . .
EXPOSE 5000
CMD ["node", "./main.js", "&"]
