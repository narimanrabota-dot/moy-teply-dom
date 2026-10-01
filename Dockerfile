# Сайт «Мой тёплый дом» на Amvera: статика через nginx
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY . /usr/share/nginx/html
RUN cd /usr/share/nginx/html && rm -f Dockerfile nginx.conf amvera.yml render.yaml .dockerignore
EXPOSE 80
