# Installation

## Run with Gunicorn

```bash
gunicorn -w 4 -b 0.0.0.0:8000 app:app
```

For production deployment, create a systemd service (on Ubuntu/Debian):

```bash
sudo nano /etc/systemd/system/game2048.service
```

```bash
[Unit]
Description=Gunicorn instance to serve game2048 app
After=network.target

[Service]
User=emkaminsk
WorkingDirectory=/path/to/your/game2048
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

The following is an example of the Nginx configuration with the security headers. Note that the port is 8002 and the server name is game2048.byst.re.

```bash
server {
    listen 8002 default_server;
    listen [::]:8002 default_server;
    server_name game2048.byst.re;

    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Add security headers
        add_header Content-Security-Policy "default-src 'self'; style-src 'self' 'unsafe-inline'  https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com; script-src 'self'";
        add_header X-Content-Type-Options nosniff;
        add_header X-Frame-Options SAMEORIGIN;
    }
    location /static/ {
        alias path/2048/static/;  # Adjust this path to match your setup
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
```

## Permissions for the font files

```bash
chmod 644 static/fontawesome/all.min.css
chmod 644 static/fontawesome/webfonts/*
```

## Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/2048 /etc/nginx/sites-enabled
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl restart game2048
```

## GitHub Actions automation

Now here's how to set up the SSH key and secrets:

  ---
  Step 1 — Generate a dedicated SSH key on the VPS
  
  Run this on your VPS (not your laptop):

  ssh-keygen -t ed25519 -C "github-actions-2048" -f ~/.ssh/github_actions_2048 -N ""

  This creates two files:
  - ~/.ssh/github_actions_2048 — private key (goes into GitHub)
  - ~/.ssh/github_actions_2048.pub — public key (stays on VPS)
  
  Step 2 — Authorize the public key on the VPS

  cat ~/.ssh/github_actions_2048.pub >> ~/.ssh/authorized_keys
  chmod 600 ~/.ssh/authorized_keys

  Step 3 — Allow *** to restart the service without a password

  Since the deploy script runs sudo systemctl restart game2048.service, add a
  passwordless sudoers rule:

  echo "*** ALL=(ALL) NOPASSWD: /bin/systemctl restart game2048.service" | sudo tee /etc/sudoers.d/github-actions-2048
  sudo chmod 440 /etc/sudoers.d/github-actions-2048

  Step 4 — Copy the private key

  cat ~/.ssh/github_actions_2048

  Copy the entire output (including the -----BEGIN... and -----END... lines).

  Step 5 — Add secrets to GitHub

  Go to: github.com → your 2048 repo → Settings → Secrets and variables → Actions → New 
  repository secret

  Add these three secrets:

  ┌──────────────┬─────────────────────────────────────────────────┐
  │     Name     │                      Value                      │
  ├──────────────┼─────────────────────────────────────────────────┤
  │ VPS_HOST     │ your VPS IP or hostname (e.g. abc.example.com) │
  ├──────────────┼─────────────────────────────────────────────────┤
  │ VPS_USERNAME │ ***                                          │
  ├──────────────┼─────────────────────────────────────────────────┤
  │ VPS_SSH_KEY  │ the private key you copied in Step 4            │
  └──────────────┴─────────────────────────────────────────────────┘
