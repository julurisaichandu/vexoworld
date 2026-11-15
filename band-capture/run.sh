#!/usr/bin/env bash
# Keeps capture.py running: restarts it 3 s after a crash, stops on Ctrl-C.
# Exit 0 (finished, e.g. --say) and 2 (a setting is missing or wrong) are not restarted.
cd "$(dirname "$0")" || exit 1
stop=0
trap 'stop=1' INT TERM
while true; do
  uv run capture.py "$@"
  code=$?
  if [ "$stop" = 1 ] || [ "$code" = 0 ] || [ "$code" = 2 ]; then exit "$code"; fi
  echo "capture stopped (exit $code); restarting in 3 s. Ctrl-C to stop." >&2
  sleep 3 &
  wait $!
  [ "$stop" = 1 ] && exit 0
done
