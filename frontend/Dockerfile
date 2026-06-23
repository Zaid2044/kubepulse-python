# ─── Frontend Dockerfile ──────────────────────────────────────────────────────
# Builds the Nginx static file server container for the frontend.
# Nginx serves HTML/CSS/JS and proxies /api/* calls to the Flask backend.

# Use the official lightweight Nginx image
FROM nginx:1.25-alpine

# Remove the default Nginx welcome page
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom Nginx config (handles proxy + static files)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the frontend source files to the Nginx static directory
COPY index.html /usr/share/nginx/html/index.html
COPY style.css  /usr/share/nginx/html/style.css
COPY app.js     /usr/share/nginx/html/app.js

# Expose port 80 (standard HTTP)
EXPOSE 80

# Default Nginx startup command (inherited from base image)
# CMD ["nginx", "-g", "daemon off;"]
