#!/bin/bash
# ─────────────────────────────────────────────────────
# Launch 3 ArduPilot SITL Boat Instances
# Run this in WSL2 after building ArduPilot
# ─────────────────────────────────────────────────────

ARDUPILOT_DIR="$HOME/ardupilot"
NUM_BOATS=3

# Default locations (spread around a harbor area)
# Sydney Harbour, Australia — fitting for an Australian navy project
LOCATIONS=(
    "-33.8568,151.2153"   # Boat 0 — near Opera House
    "-33.8540,151.2200"   # Boat 1 — 500m northeast
    "-33.8590,151.2100"   # Boat 2 — 500m southwest
)

echo "================================================="
echo "  Launching $NUM_BOATS SITL Boat Instances"
echo "  Location: Sydney Harbour, Australia"
echo "================================================="

for i in $(seq 0 $((NUM_BOATS - 1))); do
    PORT=$((14550 + i * 10))
    LOCATION=${LOCATIONS[$i]}
    
    echo "Starting Boat $i on port $PORT at $LOCATION ..."
    
    cd "$ARDUPILOT_DIR"
    sim_vehicle.py \
        -v Rover \
        --frame=motorboat \
        -I $i \
        --out=udp:127.0.0.1:$PORT \
        -l "$LOCATION,0,0" \
        --no-mavproxy \
        &
    
    sleep 2  # Wait between launches
done

echo ""
echo "All $NUM_BOATS boats launched!"
echo "Ports: 14550, 14560, 14570"
echo ""
echo "Press Ctrl+C to stop all instances"

# Wait for all background processes
wait
