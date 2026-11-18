#!/usr/bin/env bash
# ==============================================================================
# 🚦 Stream Laptop Camera (Sparsh CCTV or USB) to 5G Edge Server
# Usage: ./stream-to-server.sh <SERVER_IP>
# Example: ./stream-to-server.sh 10.0.0.1
# ==============================================================================

SERVER_ARG=""
if [ -n "$1" ]; then
  if [[ "$1" =~ ^https?:// ]]; then
    SERVER_ARG="--server $1"
  elif [[ "$1" =~ :[0-9]+$ ]]; then
    SERVER_ARG="--server http://$1"
  else
    SERVER_ARG="--server http://$1:5000"
  fi
fi

python3 stream_laptop_cctv.py ${SERVER_ARG} "$@"
