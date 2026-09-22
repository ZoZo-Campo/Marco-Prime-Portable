#!/data/data/com.termux/files/usr/bin/sh
export LD_LIBRARY_PATH=/data/data/com.termux/files/usr/lib
export LD_PRELOAD=libtermux-exec.so
export HOME=/data/data/com.termux/files/home
export PATH=/data/data/com.termux/files/usr/bin:/bin
export TMPDIR=/data/data/com.termux/files/usr/tmp
cd /data/data/com.termux/files/home/marco-tablet/marco-prime-backend || exit 1
rm -rf public/assets public/index.html
cp -r ../marco-prime-frontend/dist/* public/
echo "COPIED:"
ls public/