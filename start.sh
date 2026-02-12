#!/bin/sh
# Next.jsサーバーとWebSocketサーバーを同時起動
node server.js &
node server.ts &
wait
