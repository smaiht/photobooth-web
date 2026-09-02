#!/bin/sh

set -eu

# Настройки первого деплоя
DEPLOY_HOST=107.150.2.179
DEPLOY_USER=root
DEPLOY_PORT=22
DEPLOY_PATH=/var/www/so.gl
CERTBOT_EMAIL=''

project_directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ssh_target="$DEPLOY_USER@$DEPLOY_HOST"
ssh_command="ssh -p $DEPLOY_PORT -o ConnectTimeout=15"
remote_config=/tmp/nginx-so.gl.conf
certbot_email=$CERTBOT_EMAIL

if [ -n "$CERTBOT_EMAIL" ]; then
    case "$CERTBOT_EMAIL" in
        *@*.*) ;;
        *)
            printf 'Ошибка: некорректный CERTBOT_EMAIL\n' >&2
            exit 1
            ;;
    esac

    case "$CERTBOT_EMAIL" in
        *[!A-Za-z0-9._%+@-]*)
            printf 'Ошибка: некорректный CERTBOT_EMAIL\n' >&2
            exit 1
            ;;
    esac
fi

for required_command in scp ssh; do
    command -v "$required_command" >/dev/null 2>&1 || {
        printf 'Ошибка: не найдена команда %s\n' "$required_command" >&2
        exit 1
    }
done

printf 'Проверяю сервер %s...\n' "$ssh_target"
$ssh_command "$ssh_target" '
    set -eu
    sudo -n true
    command -v nginx >/dev/null
    command -v certbot >/dev/null
    command -v rsync >/dev/null
'

printf 'Подключаю конфигурацию Nginx...\n'
scp -P "$DEPLOY_PORT" -o ConnectTimeout=15 \
    "$project_directory/deploy/nginx-so.gl.conf" \
    "$ssh_target:$remote_config"

$ssh_command "$ssh_target" sh -s -- "$remote_config" <<'REMOTE_NGINX'
set -eu

uploaded_config=$1
available_config=/etc/nginx/sites-available/so.gl
enabled_config=/etc/nginx/sites-enabled/so.gl

sudo install -d -m 755 /var/www/so.gl

if [ ! -e "$available_config" ]; then
    sudo install -o root -g root -m 644 "$uploaded_config" "$available_config"
else
    printf 'Конфигурация %s уже существует, оставляю её без изменений.\n' "$available_config"
fi

if [ ! -e "$enabled_config" ] && [ ! -L "$enabled_config" ]; then
    sudo ln -s "$available_config" "$enabled_config"
fi

unlink "$uploaded_config"
sudo nginx -t
sudo systemctl reload nginx
REMOTE_NGINX

printf 'Настраиваю сертификат Let’s Encrypt...\n'
$ssh_command "$ssh_target" sh -s -- "$certbot_email" <<'REMOTE_CERTBOT'
set -eu

certbot_email=${1:-}

find_account() {
    sudo find /etc/letsencrypt/accounts/acme-v02.api.letsencrypt.org/directory \
        -mindepth 2 \
        -maxdepth 2 \
        -type f \
        -name regr.json \
        -exec grep -lF -- "mailto:$certbot_email" {} \; 2>/dev/null \
        | sed 's|/regr.json$||; s|.*/||' \
        | tail -n 1
}

find_latest_account() {
    sudo find /etc/letsencrypt/accounts/acme-v02.api.letsencrypt.org/directory \
        -mindepth 1 \
        -maxdepth 1 \
        -type d \
        -printf '%T@ %f\n' 2>/dev/null \
        | sort -nr \
        | sed -n '1{s/^[^ ]* //;p;}'
}

account_id=$(sudo sed -n 's/^account = //p' /etc/letsencrypt/renewal/so.gl.conf 2>/dev/null | head -n 1 || true)

if [ -z "$account_id" ] && [ -n "$certbot_email" ]; then
    account_id=$(find_account)
fi

if [ -z "$account_id" ] && [ -z "$certbot_email" ]; then
    account_id=$(find_latest_account)
fi

if [ -z "$account_id" ]; then
    if [ -n "$certbot_email" ]; then
        sudo certbot register \
            --non-interactive \
            --agree-tos \
            --no-eff-email \
            --email "$certbot_email"
        account_id=$(find_account)
    else
        sudo certbot register \
            --non-interactive \
            --agree-tos \
            --register-unsafely-without-email
        account_id=$(find_latest_account)
    fi
fi

if [ -z "$account_id" ]; then
    printf 'Ошибка: не удалось создать или найти аккаунт Certbot\n' >&2
    exit 1
fi

sudo certbot --nginx \
    --non-interactive \
    --agree-tos \
    --keep-until-expiring \
    --redirect \
    --cert-name so.gl \
    --account "$account_id" \
    -d so.gl \
    -d www.so.gl

sudo sed -i -E \
    -e 's/listen 443 ssl;/listen 443 ssl http2;/' \
    -e 's/listen \[::\]:443 ssl ipv6only=on;/listen [::]:443 ssl http2 ipv6only=on;/' \
    /etc/nginx/sites-available/so.gl

sudo nginx -t
sudo systemctl reload nginx
REMOTE_CERTBOT

"$project_directory/deploy.sh"

printf 'Первый деплой завершён: https://so.gl/\n'
