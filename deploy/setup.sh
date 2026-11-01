#!/usr/bin/env bash
# Instala y publica Comanda en un servidor Ubuntu/Debian con HTTPS automático (Caddy + sslip.io).
# Uso (como root o con sudo):
#   1) crear /opt/comanda/server/.env con las claves (ver server/.env.example)
#   2) bash setup.sh
set -euo pipefail

REPO="https://github.com/Aleprodev/comanda.git"
APP_DIR="/opt/comanda"
APP_NAME="comanda"

[ "$(id -u)" -eq 0 ] || { echo "Ejecutalo como root (sudo bash setup.sh)"; exit 1; }
[ -f "$APP_DIR/server/.env" ] || { echo "Falta $APP_DIR/server/.env. Crealo primero (modelo: server/.env.example)."; exit 1; }

export DEBIAN_FRONTEND=noninteractive
echo ">> Paquetes base"
apt-get update -y
apt-get install -y curl git ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https

if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  echo ">> Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
command -v pm2 >/dev/null || npm install -g pm2

# La imagen "Node.js" de DonWeb trae Nginx (puertos 80/443) y una app de ejemplo en el 3000:
# se apagan para que Caddy y Comanda usen esos puertos.
if systemctl list-unit-files 2>/dev/null | grep -q '^nginx.service'; then
  echo ">> Apagando Nginx de la imagen base"
  systemctl stop nginx || true
  systemctl disable nginx || true
fi
command -v pm2 >/dev/null && pm2 delete all >/dev/null 2>&1 || true

if ! command -v caddy >/dev/null; then
  echo ">> Caddy"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -y
  apt-get install -y caddy
fi

echo ">> Código"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only
else
  # el .env ya existe dentro de APP_DIR: se clona al lado y se mueve
  TMP="$(mktemp -d)"
  git clone "$REPO" "$TMP/repo"
  cp -a "$TMP/repo/." "$APP_DIR/"
  rm -rf "$TMP"
fi

cd "$APP_DIR"
npm ci
npm run build

# Dominio con HTTPS: la IP pública con guiones + sslip.io (no hace falta registrar nada)
IP="$(curl -4 -fsS https://ifconfig.me || curl -4 -fsS https://api.ipify.org)"
HOST="${IP//./-}.sslip.io"
URL="https://$HOST"
echo ">> URL pública: $URL"

ENV_FILE="$APP_DIR/server/.env"
grep -v '^PUBLIC_URL=' "$ENV_FILE" > "$ENV_FILE.tmp" || true
echo "PUBLIC_URL=$URL" >> "$ENV_FILE.tmp"
mv "$ENV_FILE.tmp" "$ENV_FILE"
chmod 600 "$ENV_FILE"

cat > /etc/caddy/Caddyfile <<EOF
$HOST {
    encode gzip
    reverse_proxy localhost:3000
}
EOF
systemctl enable caddy
systemctl restart caddy

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw allow 22/tcp
fi

echo ">> Aplicación"
pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
PORT=3000 pm2 start npm --name "$APP_NAME" --cwd "$APP_DIR" -- run start
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

sleep 3
echo ">> Chequeo"
curl -fsS "http://localhost:3000/api/health" && echo
echo
echo "Listo: $URL"
echo "Panel:  $URL/panel"
