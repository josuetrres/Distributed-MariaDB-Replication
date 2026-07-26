FROM nginx:alpine
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY ../../frontend /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
