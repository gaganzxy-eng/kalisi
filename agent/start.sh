#!/bin/bash
# Prevent Android battery saver from killing Termux background process
termux-wake-lock 2>/dev/null || true

echo "=========================================================="
echo " Starting Kalisi SMP Phone Agent on http://0.0.0.0:8728"
echo "=========================================================="

python -m uvicorn main:app --host 0.0.0.0 --port 8728
