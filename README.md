# Games

A small Flask app that serves browser games through a shared shell. The shell
provides a home button and a hamburger menu that opens a sidebar for switching
between games. Each game lives in its own self-contained folder and is loaded
into an `<iframe>`, so new games can be added without touching the others.

Currently included:

- **2048** — the full game.
- **Snake** — classic Nokia 3310-style game (keyboard + swipe).
- **Arkanoid** — brick-breaker with multiple levels, power-ups, and a
  text-file level-design system (keyboard, mouse, or on-screen buttons).

## Project structure

```
.
├── index.html          # Shell: home icon + hamburger nav, sidebar, game <iframe>
├── shell.js            # Sidebar open/close + iframe game-swapping
├── style.css           # Shell/sidebar chrome styles only
├── app.py              # Flask server (routes "/", "/shell.js", and src/ files)
├── all.min.css         # FontAwesome (icons used by the shell)
├── fa-solid-900.*      # FontAwesome font files
├── requirements.txt
└── src/
    ├── 2048/
    │   ├── index.html  # Self-contained 2048 page
    │   ├── style.css   # Grid + tile styles
    │   ├── game.js     # Game logic
    │   └── test/
    │       └── test_shell.py   # Playwright UI test for the shell + games
    ├── snake/
    │   ├── index.html  # Self-contained Snake page
    │   ├── style.css   # Nokia-LCD screen styles
    │   ├── game.js     # Snake game logic
    │   └── test/
    │       └── test_snake.py   # Playwright UI test for Snake
    └── arkanoid/
        ├── index.html  # Self-contained Arkanoid page
        ├── style.css   # Canvas/HUD/overlay/mobile-control styles
        ├── game.js     # Arkanoid game logic (loads levels from levels/)
        ├── levels/
        │   ├── README.txt   # Level text-file format reference
        │   └── level1..5.txt   # Level layouts (one char per tile)
        └── test/
            └── test_levels.py   # Level format + Playwright loading tests
```

### Adding a new game

1. Create `src/<game>/index.html` (self-contained, with its own CSS/JS).
2. Add a sidebar entry in `index.html`:
   `<li><button class="game-link" data-src="/src/<game>/index.html"><Name></button></li>`

The shell handles the rest — no changes to other games required.

## Arkanoid

A classic brick-breaker rendered on an HTML5 `<canvas>`.

- **Controls:** arrow keys or the mouse to move the paddle, **Space** to launch
  the ball. On touch devices, on-screen left/right buttons are provided.
- **Goal:** clear every brick to advance to the next level. You start with 3
  lives; losing the ball costs a life.
- **Power-ups:** falling bonuses occasionally drop from broken bricks — a
  **wide paddle** (temporary) and an **extra life**.
- **HUD:** live score, current level, and remaining lives.

### Designing levels

Levels live in `src/arkanoid/levels/` as plain-text files and are loaded in
order (`level1.txt`, `level2.txt`, …). Each non-comment line is a row of tiles
and each character is one column (up to 10 columns):

| Char | Color  | | Char | Color  |
|------|--------|-|------|--------|
| `R`  | Red    | | `B`  | Blue   |
| `O`  | Orange | | `P`  | Purple |
| `Y`  | Yellow | | `W`  | White  |
| `G`  | Green  | | `C`  | Cyan   |

A `.` or a space is an empty cell; lines starting with `#` are comments. To add
a level, drop a new `level*.txt` file in the folder and register it in the
`LEVEL_FILES` array in `src/arkanoid/game.js`. See
`src/arkanoid/levels/README.txt` for the full format reference.

## Local development & testing

This project uses [uv](https://docs.astral.sh/uv/) to run Python without
managing a virtualenv by hand.

### Run the app locally

```bash
uv run --with flask==2.3.3 --with Werkzeug==2.3.7 flask --app app run --port 5099
```

Then open <http://127.0.0.1:5099/>.

### Run the UI test

The Playwright test exercises the shell: it verifies 2048 loads by default, the
hamburger opens the sidebar, selecting Snake swaps the iframe and closes the
sidebar, switching back to 2048 works, and Escape closes the sidebar.

With the app running (in another terminal, on port 5099):

```bash
uv run --with playwright python src/2048/test/test_shell.py
```

There is also a per-game test for Snake (start screen, keyboard start, reversal
guard, pause/resume, wall-collision game over, and Play Again):

```bash
uv run --with playwright python src/snake/test/test_snake.py
```

The Arkanoid test has two phases: it validates every level file's format in
pure Python (valid tile characters, at least one tile, ≤10 columns), then uses
Playwright to confirm the live game fetches each level and produces the exact
tile count the parser expects:

```bash
uv run --with playwright python src/arkanoid/test/test_levels.py
```

Override the target URL with the `BASE_URL` environment variable if needed
(defaults to `http://127.0.0.1:5099`).

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
