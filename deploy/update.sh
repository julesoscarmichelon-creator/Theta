#!/usr/bin/env bash
# Envoie le contenu de public/ sur le VPS et recharge Caddy.
# Usage : ./deploy/update.sh <IP_DU_VPS> [utilisateur_ssh]
#
# Exemple : ./deploy/update.sh 51.83.12.34 debian

set -euo pipefail

IP="${1:?Usage: ./deploy/update.sh <IP_DU_VPS> [utilisateur_ssh]}"
USER="${2:-debian}"
REMOTE_DIR="theta/public"

echo "Envoi de public/ vers ${USER}@${IP}:~/${REMOTE_DIR} ..."
ssh "${USER}@${IP}" "mkdir -p ~/${REMOTE_DIR}"
rsync -avz --delete "$(dirname "$0")/../public/" "${USER}@${IP}:~/${REMOTE_DIR}/"

echo "Rechargement de Caddy ..."
ssh "${USER}@${IP}" "sudo systemctl reload caddy"

echo "Terminé. Le site est à jour."
