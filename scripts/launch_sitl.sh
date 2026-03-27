#!/bin/bash
# ─────────────────────────────────────────────────────
# Launch 3 ArduPilot SITL Boat Instances
# Run this in WSL2 after building ArduPilot
# ─────────────────────────────────────────────────────

ARDUPILOT_DIR="$HOME/ardupilot"
NUM_BOATS=3

# Spawn locations in Sydney Harbour (water)
# Format: "lat,lon"
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

    # Each instance needs its own directory so EEPROM/logs don't conflict
    INSTANCE_DIR="$HOME/sitl_boat_$i"
    mkdir -p "$INSTANCE_DIR"

    echo "Starting Boat $i on port $PORT at $LOCATION (dir: $INSTANCE_DIR) ..."

    cd "$INSTANCE_DIR"

    # --custom-location accepts raw "lat,lon,alt,heading" coordinates.
    # -l / --location looks up a named entry in locations.txt — wrong for custom coords.
    "$ARDUPILOT_DIR/Tools/autotest/sim_vehicle.py" \
        -v Rover \
        --frame=motorboat \
        -I "$i" \
        --out=udp:127.0.0.1:"$PORT" \
        --custom-location="$LOCATION,0,0" \
        --no-mavproxy \
        --speedup=1 \
        &

    sleep 3  # Give each instance time to bind its ports before the next one starts
done

echo ""
echo "All $NUM_BOATS boats launched!"
echo "Ports: 14550, 14560, 14570"
echo "Working dirs: ~/sitl_boat_0, ~/sitl_boat_1, ~/sitl_boat_2"
echo ""
echo "Press Ctrl+C to stop all instances"

wait
