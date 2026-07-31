#!/bin/sh

set -eu

# Настройки деплоя
DEPLOY_HOST=51.250.37.166
DEPLOY_USER=yc-user
DEPLOY_PORT=22
DEPLOY_PATH=/var/www/so.gl

project_directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ssh_target="$DEPLOY_USER@$DEPLOY_HOST"
ssh_command="ssh -p $DEPLOY_PORT -o ConnectTimeout=15"
cache_version=$(date -u +%Y%m%d%H%M%S)

for public_item in index.html style.css app.js assets robots.txt sitemap.xml; do
    test -e "$project_directory/$public_item" || {
        printf 'Ошибка: не найден %s\n' "$public_item" >&2
        exit 1
    }
done

for required_command in rsync ssh; do
    command -v "$required_command" >/dev/null 2>&1 || {
        printf 'Ошибка: не найдена команда %s\n' "$required_command" >&2
        exit 1
    }
done

printf 'Публикую сайт на %s...\n' "$ssh_target"

$ssh_command "$ssh_target" "sudo install -d -m 755 '$DEPLOY_PATH'"

rsync -rlptz \
    --delete \
    --delete-excluded \
    --exclude='.DS_Store' \
    --exclude='Thumbs.db' \
    --include='/index.html' \
    --include='/style.css' \
    --include='/app.js' \
    --include='/assets/***' \
    --include='/robots.txt' \
    --include='/sitemap.xml' \
    --exclude='*' \
    --rsync-path='sudo rsync' \
    -e "$ssh_command" \
    "$project_directory/" \
    "$ssh_target:$DEPLOY_PATH/"

$ssh_command "$ssh_target" \
    "sudo sed -i -E 's/\\?v=[A-Za-z0-9._-]+/?v=$cache_version/g' '$DEPLOY_PATH/index.html' '$DEPLOY_PATH/style.css' '$DEPLOY_PATH/app.js'"

printf 'Готово: https://so.gl/ (версия кеша %s)\n' "$cache_version"
