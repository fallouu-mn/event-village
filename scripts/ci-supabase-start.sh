#!/usr/bin/env bash
# Lot CI rapide — démarrage de Supabase local en CI (.github/workflows/verify.yml), commun à tous les jobs.
#
# Mêmes services qu'avant (studio, imgproxy, logflare, vector et edge-runtime exclus). Lot 7 (runs 81 et 82) puis lot CI
# rapide (run 309, lot 4) : le runner a refusé le port 54322 (« address already in use ») ; les ports 54320-54329 sont
# réservés dès le début du job (sysctl ip_local_reserved_ports), et ce script fait trois tentatives, avec arrêt propre
# entre deux, en écrivant les sockets de tous états sur ces ports et les conteneurs dans le journal.
#
# Usage : scripts/ci-supabase-start.sh <journal>   (code de sortie : 0 si Supabase a démarré)
# Le job e2e le lance en arrière-plan pendant npm ci et attend son code dans <journal>.code.
set -o pipefail
journal="${1:-/tmp/supabase-start.log}"
ports() { echo "sockets sur 54320-54329 ($1) :"; (sudo ss -tanp | grep -E ':5432[0-9]\b' || echo "aucun"); }
ports "avant démarrage" > "$journal" 2>&1
ok=0
for essai in 1 2 3; do
  if supabase start -x studio,imgproxy,logflare,vector,edge-runtime >> "$journal" 2>&1; then ok=1; break; fi
  echo "::warning::supabase start a échoué (essai ${essai}) ; ports, conteneurs, arrêt propre puis nouvelle tentative"
  { ports "après l'échec ${essai}"; docker ps -a --format '{{.Names}} {{.Status}} {{.Ports}}'; } >> "$journal" 2>&1
  [ "$essai" -lt 3 ] || break
  supabase stop --no-backup >> "$journal" 2>&1
  sleep $((essai * 15))
done
code=$([ "$ok" = 1 ] && echo 0 || echo 1)
echo "$code" > "${journal}.code"
exit "$code"
