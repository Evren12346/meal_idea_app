#!/bin/bash
cd "$(dirname "$0")"
npm start &
sleep 3
xdg-open http://localhost:3000 2>/dev/null || open http://localhost:3000 2>/dev/null || echo "Server running at http://localhost:3000"
wait
