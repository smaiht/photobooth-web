#!/bin/sh

set -eu

DEPLOY_HOST=${DEPLOY_HOST:-15.235.192.176}
DEPLOY_USER=${DEPLOY_USER:-root}
DEPLOY_PORT=${DEPLOY_PORT:-22}
DEPLOY_PATH=${DEPLOY_PATH:-/var/www/so.gl}

fail() {
    printf 'Ошибка: %s\n' "$1" >&2
    exit 1
}

case "$DEPLOY_HOST" in
    ''|*[!A-Za-z0-9.:-]*) fail "некорректный DEPLOY_HOST" ;;
esac

case "$DEPLOY_USER" in
    ''|*[!A-Za-z0-9._-]*) fail "некорректный DEPLOY_USER" ;;
esac

case "$DEPLOY_PORT" in
    ''|*[!0-9]*) fail "DEPLOY_PORT должен быть числом" ;;
esac

site_directory=${DEPLOY_PATH#/var/www/}
if [ "/var/www/$site_directory" != "$DEPLOY_PATH" ]; then
    fail "DEPLOY_PATH должен находиться внутри /var/www"
fi

case "$site_directory" in
    ''|*[!A-Za-z0-9._-]*) fail "некорректный DEPLOY_PATH" ;;
esac

command -v tar >/dev/null 2>&1 || fail "не найдена команда tar"
command -v scp >/dev/null 2>&1 || fail "не найдена команда scp"
command -v ssh >/dev/null 2>&1 || fail "не найдена команда ssh"

project_directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
temporary_directory=$(mktemp -d "${TMPDIR:-/tmp}/photobooth-web-deploy.XXXXXX")
archive="$temporary_directory/site.tar.gz"
deploy_id="$(date +%Y%m%d-%H%M%S)-$$"
remote_archive="/tmp/photobooth-web-$deploy_id.tar.gz"
ssh_target="$DEPLOY_USER@$DEPLOY_HOST"

cleanup_local() {
    rm -rf -- "$temporary_directory"
}

trap cleanup_local 0 HUP INT TERM

set -- index.html style.css app.js assets robots.txt sitemap.xml
for public_item do
    if [ ! -e "$project_directory/$public_item" ]; then
        fail "не найден обязательный файл сайта: $public_item"
    fi
done

printf 'Собираю файлы сайта...\n'
COPYFILE_DISABLE=1 tar --no-xattrs -czf "$archive" -C "$project_directory" "$@"

printf 'Загружаю файлы на %s...\n' "$ssh_target"
scp \
    -P "$DEPLOY_PORT" \
    -o ConnectTimeout=15 \
    "$archive" \
    "$ssh_target:$remote_archive"

printf 'Публикую сайт в %s...\n' "$DEPLOY_PATH"
ssh \
    -p "$DEPLOY_PORT" \
    -o ConnectTimeout=15 \
    "$ssh_target" \
    sh -s -- "$DEPLOY_PATH" "$remote_archive" "$deploy_id" <<'REMOTE_SCRIPT'
set -eu

web_root=$1
archive=$2
deploy_id=$3
parent_directory=$(dirname -- "$web_root")
site_directory=$(basename -- "$web_root")
staging_directory="$parent_directory/.$site_directory.deploy-$deploy_id"
replaced_directory="$parent_directory/.$site_directory.replaced-$deploy_id"
old_site_moved=0
new_site_published=0

case "$web_root" in
    /var/www/*) ;;
    *)
        printf 'Ошибка: небезопасный путь публикации: %s\n' "$web_root" >&2
        exit 1
        ;;
esac

cleanup_remote() {
    rm -f -- "$archive"
    if [ -d "$staging_directory" ]; then
        rm -rf -- "$staging_directory"
    fi
    if [ "$old_site_moved" -eq 1 ] && [ "$new_site_published" -eq 0 ] && [ ! -e "$web_root" ]; then
        mv -- "$replaced_directory" "$web_root"
    fi
    if [ "$new_site_published" -eq 1 ] && [ -e "$replaced_directory" ]; then
        rm -rf -- "$replaced_directory"
    fi
}

trap cleanup_remote 0 HUP INT TERM

install -d -m 755 "$staging_directory"
tar -xzf "$archive" -C "$staging_directory"

test -f "$staging_directory/index.html"
test -f "$staging_directory/style.css"
test -f "$staging_directory/app.js"

find "$staging_directory" -type d -exec chmod 755 {} +
find "$staging_directory" -type f -exec chmod 644 {} +
chown -R root:root "$staging_directory"

if command -v nginx >/dev/null 2>&1; then
    nginx -t
fi

if [ -e "$web_root" ] || [ -L "$web_root" ]; then
    mv -- "$web_root" "$replaced_directory"
    old_site_moved=1
fi

if ! mv -- "$staging_directory" "$web_root"; then
    if [ "$old_site_moved" -eq 1 ]; then
        mv -- "$replaced_directory" "$web_root"
        old_site_moved=0
    fi
    exit 1
fi
new_site_published=1

if [ "$old_site_moved" -eq 1 ]; then
    rm -rf -- "$replaced_directory"
    old_site_moved=0
fi

if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet nginx; then
    systemctl reload nginx
fi

printf 'Сайт опубликован: %s\n' "$web_root"
REMOTE_SCRIPT

printf 'Готово: https://so.gl/\n'
