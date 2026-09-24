#!/data/data/com.termux/files/usr/bin/sh
# Deploie termux-autorun.sh dans ~/.bashrc et ~/.profile.
# Usage (sur la tablette, via run-as) :
#   sh deploy-terms.sh
export HOME=/data/data/com.termux/files/home

SNIPPET_FILE="$HOME/termux-autorun.sh"
cat "$SNIPPET_FILE" > "$HOME/.bashrc" 2>/dev/null || cp "$SNIPPET_FILE" "$HOME/.bashrc"
cat "$SNIPPET_FILE" > "$HOME/.profile" 2>/dev/null || cp "$SNIPPET_FILE" "$HOME/.profile"
echo "done"
ls -la "$HOME/.bashrc" "$HOME/.profile" "$SNIPPET_FILE"