FROM node:24-alpine AS build
WORKDIR /app
ARG VITE_MERCADOPAGO_PUBLIC_KEY
ENV VITE_MERCADOPAGO_PUBLIC_KEY=$VITE_MERCADOPAGO_PUBLIC_KEY
ARG VITE_SENTRY_DSN
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
COPY package*.json ./
RUN npm ci
COPY index.html ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
