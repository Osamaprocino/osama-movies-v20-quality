#!/bin/bash
# نشر سينما أسامة على Ubuntu/Debian — شغّله كـ root من داخل مجلد المشروع:  bash deploy/deploy.sh
set -e
[ "$(id -u)" = 0 ] || { echo "شغّل السكربت كـ root"; exit 1; }
APP="$(cd "$(dirname "$0")/.." && pwd)"
echo "== الدومين (اتركه فارغاً إن لم يكن عندك، وسيعمل الموقع على http://IP) =="; read -r -p "الدومين: " DOMAIN
echo "== كلمة سر مدير الموقع (اسم المستخدم: admin) =="; read -r -s -p "كلمة السر (10 أحرف فأكثر): " ADMINPW; echo
read -r -p "تثبيت ffmpeg لتوليد جودات 360/720؟ (ثقيل على معالج واحد) [y/N]: " FF
export DEBIAN_FRONTEND=noninteractive
apt-get update -y && apt-get install -y curl ca-certificates gnupg ufw unzip cron
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs
fi
[ "$FF" = y ] || [ "$FF" = Y ] && apt-get install -y ffmpeg
cd "$APP" && npm install --omit=dev --no-audit --no-fund
mkdir -p data uploads
[ -f data/admin.json ] || [ -f admin.json ] || node create-admin.js admin "$ADMINPW"
if [ -n "$DOMAIN" ]; then PUB="https://$DOMAIN"; else PUB="http://$(curl -s ifconfig.me || echo localhost)"; fi
cat > /etc/systemd/system/cinema.service <<UNIT
[Unit]
Description=Osama Cinema
After=network.target
[Service]
WorkingDirectory=$APP
Environment=PORT=3000
Environment=PUBLIC_URL=$PUB
ExecStart=$(command -v node) server.js
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload && systemctl enable --now cinema
# مدخل الويب: Caddy (HTTPS تلقائي مع الدومين)
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sed 's#^deb #deb [signed-by=/usr/share/keyrings/caddy.gpg] #' > /etc/apt/sources.list.d/caddy.list
apt-get update -y && apt-get install -y caddy
if [ -n "$DOMAIN" ]; then printf '%s {\n  request_body {\n    max_size 20GB\n  }\n  reverse_proxy localhost:3000\n}\n' "$DOMAIN" > /etc/caddy/Caddyfile
else printf ':80 {\n  request_body {\n    max_size 20GB\n  }\n  reverse_proxy localhost:3000\n}\n' > /etc/caddy/Caddyfile; fi
systemctl restart caddy
ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw --force enable
# نسخ احتياطي يومي لمجلد data (الحسابات والإعدادات) مع الاحتفاظ بـ 7 نسخ
mkdir -p /root/backups
cat > /etc/cron.daily/cinema-backup <<CRON
#!/bin/bash
tar czf /root/backups/data-\$(date +%F).tgz -C $APP data
ls -t /root/backups/data-*.tgz | tail -n +8 | xargs -r rm
CRON
chmod +x /etc/cron.daily/cinema-backup
echo; echo "تم ✅  الموقع: $PUB    لوحة الإدارة: $PUB/admin-login.html"
echo "الحالة: systemctl status cinema   —  السجل: journalctl -u cinema -f"
