FROM nginx:alpine
RUN sed -i 's/listen\s*80;/listen 8080;/' /etc/nginx/conf.d/default.conf
COPY dashboard/index.html /usr/share/nginx/html/index.html
COPY dashboard/config.json /usr/share/nginx/html/config.json
EXPOSE 8080
