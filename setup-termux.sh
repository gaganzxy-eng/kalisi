#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
#  KALISI SMP ULTIMATE HOSTING PANEL — TERMUX AGENT SETUP SCRIPT
#  Target: Android OPPO Phone (Termux)
# ==============================================================================

set -e

echo "=========================================================="
echo "  Kalisi SMP — Termux Agent Automated Installer"
echo "  Domain: kalisiadudhamsmpseason2.in"
echo "=========================================================="

# 1. Update Termux packages
echo "[1/6] Updating Termux packages..."
pkg update -y && pkg upgrade -y

# 2. Install essential dependencies
echo "[2/6] Installing dependencies (Python, OpenSSL, Git, Tar, Curl, Jq)..."
pkg install -y python python-pip git curl jq openssl procps

# 3. Check / Create Minecraft Server Directory
MC_DIR="$HOME/minecraft-server"
if [ ! -d "$MC_DIR" ]; then
    echo "[!] Minecraft server directory not found at $MC_DIR. Creating..."
    mkdir -p "$MC_DIR"
    echo "[*] Please make sure to place your paper.jar inside $MC_DIR"
else
    echo "[✓] Found existing Minecraft directory at $MC_DIR"
fi

# 4. Set up Agent Environment
AGENT_DIR="$HOME/craft-agent"
echo "[3/6] Setting up Agent directory at $AGENT_DIR..."
mkdir -p "$AGENT_DIR"
mkdir -p "$AGENT_DIR/backups"
mkdir -p "$AGENT_DIR/data"

# Copy agent files if running from local repo or cloned repo
if [ -d "./agent" ]; then
    cp -r ./agent/* "$AGENT_DIR/"
fi

cd "$AGENT_DIR"

# 5. Install Python dependencies
echo "[4/6] Installing Python packages..."
pip install --upgrade pip
if [ -f "$AGENT_DIR/requirements.txt" ]; then
    pip install -r "$AGENT_DIR/requirements.txt"
else
    pip install fastapi "uvicorn[standard]" "python-jose[cryptography]" "passlib[bcrypt]" psutil python-multipart pydantic pydantic-settings aiofiles websockets
fi

# 6. Generate secure environment file (.env)
if [ ! -f "$AGENT_DIR/.env" ]; then
    echo "[5/6] Generating secure secrets in .env..."
    JWT_SECRET=$(openssl rand -hex 32)
    API_KEY=$(openssl rand -hex 24)
    DEFAULT_PASS=$(openssl rand -base64 12)

    cat <<EOF > "$AGENT_DIR/.env"
# Kalisi SMP Agent Configuration
PORT=8728
HOST=127.0.0.1
MINECRAFT_DIR=$MC_DIR
SERVER_JAR=paper.jar
JAVA_BIN=java
MIN_RAM=1G
MAX_RAM=3G

# Security & Authentication
JWT_SECRET=$JWT_SECRET
API_SECRET_KEY=$API_KEY
ADMIN_USERNAME=admin
ADMIN_PASSWORD=$DEFAULT_PASS
ACCESS_TOKEN_EXPIRE_MINUTES=43200

# Cloudflare Access (Optional / Recommended)
CLOUDFLARE_ACCESS_TEAM_DOMAIN=
CLOUDFLARE_AUD_TAG=
EOF

    echo "=========================================================="
    echo "  [IMPORTANT CREDENTIALS GENERATED]"
    echo "  Admin Username : admin"
    echo "  Admin Password : $DEFAULT_PASS"
    echo "  API Secret Key : $API_KEY"
    echo "  Config saved to: $AGENT_DIR/.env"
    echo "=========================================================="
else
    echo "[✓] Existing .env found at $AGENT_DIR/.env"
fi

# 7. Create Start Script
cat << 'EOF' > "$AGENT_DIR/start.sh"
#!/data/data/com.termux/files/usr/bin/bash
cd "$HOME/craft-agent"
# Prevent Android battery killer from sleeping Termux
termux-wake-lock 2>/dev/null || true
echo "Starting Kalisi SMP Phone Agent on port 8728..."
python -m uvicorn main:app --host 0.0.0.0 --port 8728
EOF
chmod +x "$AGENT_DIR/start.sh"

echo "[6/6] Setup completed successfully!"
echo "To launch the agent, run:"
echo "    cd ~/craft-agent && ./start.sh"
echo "=========================================================="
