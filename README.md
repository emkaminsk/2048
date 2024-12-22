#Installation

## Run with Gunicorn

```bash
gunicorn -w 4 -b 0.0.0.0:8000 app:app
```

For production deployment, create a systemd service (on Ubuntu/Debian):

```bash
sudo nano /etc/systemd/system/myapp.service
```

```bash
[Unit]
Description=Gunicorn instance to serve 2048 app
After=network.target

[Service]
User=emkaminsk
WorkingDirectory=/path/to/your/app
Environment="PATH=/path/to/your/venv/bin"
ExecStart=/path/to/your/venv/bin/gunicorn -w 4 -b 0.0.0.0:8000 app:app

[Install]
WantedBy=multi-user.target
```

## Start and enable the service:

```bash
sudo systemctl start myapp
sudo systemctl enable myapp
```

## Create Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/2048
```

```bash
server {
    listen 80;
    server_name your_domain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/2048 /etc/nginx/sites-enabled
sudo nginx -t
sudo systemctl restart nginx
```

