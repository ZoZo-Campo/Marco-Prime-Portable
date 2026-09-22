#!/data/data/com.termux/files/usr/bin/sh
B=/data/data/com.termux/files/home/marco-tablet/marco-prime-backend/public
D=/data/data/com.termux/files/home/marco-tablet/marco-prime-frontend/dist
mkdir -p $B/icons $D/icons
cp /data/local/tmp/sw.js $B/sw.js
cp /data/local/tmp/manifest.json $B/manifest.json
cp /data/local/tmp/icon-192.png $B/icons/
cp /data/local/tmp/icon-512.png $B/icons/
cp $B/sw.js $D/sw.js
cp $B/manifest.json $D/manifest.json
cp $B/icons/icon-192.png $D/icons/
cp $B/icons/icon-512.png $D/icons/
chown -R 10131:10131 $B $D
echo "PWA files in backend public:"
ls $B $B/icons