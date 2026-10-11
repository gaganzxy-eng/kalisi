# ⚔️ Kalisi SMP Ultimate Hosting Panel

A production-grade Minecraft Java server management platform inspired by **Pterodactyl** and **Aternos**, architected specifically for running a real **PaperMC** server directly on an **Android phone via Termux**, controlled remotely through a Next.js web application deployed to **Vercel** via **Cloudflare Tunnel** and **Playit.gg**.

---

## 🏛️ System Architecture

```mermaid
graph TB
    subgraph "Players & Public Game Traffic"
        MC[Minecraft Java Clients] -->|Playit.gg Tunnel| GAME[Local Port 25565]
    end

    subgraph "Web Admin & Remote Management"
        ADMIN[Web Browser / Admin] -->|HTTPS| CF_ACC[Cloudflare Access / Zero Trust]
        CF_ACC --> VERCEL[Next.js Frontend on Vercel\nkalisiadudhamsmpseason2.in]
        VERCEL -->|REST & WebSocket| CF_TUNNEL[Cloudflare Tunnel\napi.kalisiadudhamsmpseason2.in]
    end

    subgraph "Android OPPO Phone (Termux)"
        CF_TUNNEL -->|127.0.0.1:8728| AGENT[Python FastAPI Phone Agent]
        AGENT -->|Process Mgmt & Stdin/Stdout| PAPER[PaperMC Server Process (paper.jar)]
        AGENT -->|Path Traversal Guard| FS[Server Files: ~/minecraft-server]
        AGENT -->|psutil & Termux API| METRICS[CPU / RAM / Disk Collector]
        AGENT -->|SQLite3| DB[Audit Log & Backup Catalog]
        PAPER --> GAME
    end
```

---

## 🚀 Key Features

| Module | Features |
|---|---|
| **📊 Dashboard** | Real-time server state (Running, Starting, Stopped, Crashed), PID tracking, CPU/RAM usage, player count, quick Start / Stop / Restart actions. |
| **💻 Live Console** | Low-latency log streaming via WebSocket, interactive command input with command history, search filter, auto-scroll. |
| **📁 File Manager** | Full directory browser for `~/minecraft-server`, in-browser text editor for `.properties`, `.yml`, `.json`, `.txt`, file uploads, downloads, deletion with path-traversal protection. |
| **🧩 Plugin Manager** | Upload `.jar` plugins, toggle enable/disable on the fly (renames to `.jar.disabled`), quick jump to plugin configuration folders. |
| **👥 Player Management** | Live online player cards with skins from Minotar, whitelist manager (add/remove), operator (OP) manager (grant/revoke), in-game whispers and gamemode switcher. |
| **🛡️ Moderation Center** | One-click Kick, Ban, and Pardon/Unban actions with required reason auditing and historical logs. |
| **🌍 World Explorer** | Automatic detection of Overworld, Nether, and The End dimensions, disk size calculation, direct file manager links, single-world backups. |
| **💾 Backups & Recovery** | Create full or world-only zip archives, download snapshots, delete archives, and **Safe Restore** (automatically captures a pre-restore recovery snapshot before unzipping). |
| **⚙️ Server Settings** | Friendly form for all `server.properties` (MOTD, port, max players, difficulty, online-mode, view-distance) plus a raw searchable editor. |
| **📜 Activity & Audit** | Immutable SQLite log of all admin operations (logins, commands, file writes, backups, reboots) with timestamps and IP addresses. |

---

## 📱 Step 1: Phone Setup (Android OPPO / Termux)

### 1. Install & Prepare Termux
1. Download Termux from [F-Droid](https://f-droid.org/en/packages/com.termux/) (do **not** use the deprecated Google Play Store version).
2. Open Termux and grant storage access:
   ```bash
   termux-setup-storage
   ```
3. Disable battery optimization for Termux in OPPO phone settings (`Settings -> Battery -> App Battery Management -> Termux -> Allow background activity & Allow auto-launch`).

### 2. Run the Automated Installer
From your Termux terminal:
```bash
# Clone or copy your craft-panel repository
git clone https://github.com/your-username/craft-panel.git ~/craft-panel
cd ~/craft-panel

# Make installer executable and run
chmod +x setup-termux.sh
./setup-termux.sh
```

The script will automatically:
- Install Python, OpenSSL, curl, jq, and process tools.
- Install all FastAPI, Uvicorn, and JWT dependencies.
- Verify or initialize `~/minecraft-server`.
- Generate secure `JWT_SECRET` and random administrator credentials in `~/craft-agent/.env`.

### 3. Verify Server JAR
Ensure your Paper Minecraft server JAR is placed at `~/minecraft-server/paper.jar`:
```bash
ls -lh ~/minecraft-server/paper.jar
```

### 4. Start the Agent
```bash
cd ~/craft-agent
./start.sh
```
The agent will output:
```text
Starting Kalisi SMP Phone Agent on port 8728...
INFO:     Uvicorn running on http://0.0.0.0:8728
```

---

## ☁️ Step 2: Cloudflare Tunnel Configuration

To connect your Vercel frontend securely to your phone without opening ports or needing a public IP:

1. Install `cloudflared` inside Termux:
   ```bash
   pkg install -y cloudflared
   ```
2. Login to your Cloudflare account:
   ```bash
   cloudflared tunnel login
   ```
3. Create a tunnel named `kalisi-tunnel`:
   ```bash
   cloudflared tunnel create kalisi-tunnel
   ```
4. Copy the example configuration:
   ```bash
   mkdir -p ~/.cloudflared
   cp ~/craft-panel/cloudflared-config.yml.example ~/.cloudflared/config.yml
   ```
5. Edit `~/.cloudflared/config.yml` with your tunnel UUID and route `api.kalisiadudhamsmpseason2.in` to `http://127.0.0.1:8728`.
6. Route DNS for your subdomain:
   ```bash
   cloudflared tunnel route dns kalisi-tunnel api.kalisiadudhamsmpseason2.in
   ```
7. Run the tunnel:
   ```bash
   cloudflared tunnel run kalisi-tunnel
   ```

---

## 🌐 Step 3: Frontend Deployment (Vercel)

1. Push this repository to GitHub or GitLab.
2. Go to [Vercel](https://vercel.com) and click **"Add New Project"**.
3. Select your repository and configure:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Next.js
4. Set Environment Variable:
   - `NEXT_PUBLIC_API_URL` = `https://api.kalisiadudhamsmpseason2.in`
5. Click **Deploy**.
6. Under **Project Settings -> Domains**, assign your custom domain:
   - `kalisiadudhamsmpseason2.in`

---

## 🎮 Step 4: Playit.gg Setup (Minecraft Game Traffic)

Playit.gg allows Minecraft players to join your server over the internet:

1. Install Playit.gg in Termux:
   ```bash
   curl -SsL https://playit-cloud.github.io/ppa/key.gpg | gpg --dearmor | tee /data/data/com.termux/files/usr/etc/apt/trusted.gpg.d/playit.gpg > /dev/null
   echo "deb [signed-by=/data/data/com.termux/files/usr/etc/apt/trusted.gpg.d/playit.gpg] https://playit-cloud.github.io/ppa/data ./" | tee /data/data/com.termux/files/usr/etc/apt/sources.list.d/playit.list
   pkg update -y
   pkg install -y playit
   ```
2. Run `playit` in Termux and follow the claim URL to claim your agent in your Playit.gg dashboard.
3. Add a Minecraft Java tunnel mapping to `127.0.0.1:25565`.
4. Players connect using your Playit tunnel domain or a CNAME record set to `kalisiadudhamsmpseason2.in`.

---

## 🔒 Security Best Practices

1. **Authentication**: All endpoints require a signed JWT bearer token. Never commit your `.env` secrets.
2. **Path Traversal Protection**: The phone agent enforces strict canonical path sandboxing within `~/minecraft-server`. Any attempt to access `/`, `/data`, or system files is blocked and audited.
3. **Restricted Shell Execution**: The console only accepts valid Minecraft commands, completely blocking arbitrary bash/sh command execution.
4. **Cloudflare Zero Trust**: For extra security, enable Cloudflare Access on `api.kalisiadudhamsmpseason2.in` to restrict panel traffic only to authorized admin emails.

---

## 🛠️ Local Development

### Run the Agent locally:
```bash
cd agent
python -m venv venv
source venv/bin/activate # or venv\Scripts\activate on Windows
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8728 --reload
```

### Run the Frontend locally:
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.
