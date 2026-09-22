#!/data/data/com.termux/files/usr/bin/sh
export LD_LIBRARY_PATH=/data/data/com.termux/files/usr/lib
export LD_PRELOAD=libtermux-exec.so
export HOME=/data/data/com.termux/files/home
export PATH=/data/data/com.termux/files/usr/bin:/bin:/usr/bin
export TMPDIR=/data/data/com.termux/files/usr/tmp
export USER=$(id -un)
cd /data/data/com.termux/files/home/marco-tablet/marco-prime-backend
nohup node dist/index.js >> server.log 2>&1 &
echo $!
