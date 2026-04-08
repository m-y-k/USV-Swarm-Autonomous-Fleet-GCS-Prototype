#!/bin/bash
# ─────────────────────────────────────────────────────
# Launch 3 ArduPilot SITL Boat Instances
# Run this in WSL2 after building ArduPilot
# ─────────────────────────────────────────────────────

ARDUPILOT_DIR="$HOME/ardupilot"
NUM_BOATS=3
BINARY="$ARDUPILOT_DIR/build/sitl/bin/ardurover"

# Spawn locations in Sydney Harbour (water)
# Format: "lat,lon"
LOCATIONS=(
    "-33.8568,151.2153"   # Boat 0 — near Opera House
    "-33.8540,151.2200"   # Boat 1 — 500m northeast
    "-33.8595,151.2180"   # Boat 2 — 500m south-east (harbour basin)
)

echo "================================================="
echo "  Launching $NUM_BOATS SITL Boat Instances"
echo "  Location: Sydney Harbour, Australia"
echo "================================================="

# ── Step 1: Build once (only if binary is missing or outdated) ─────────────
# Running all 3 instances with --build simultaneously causes WAF lock conflicts.
# Build once here, then launch all instances with --no-rebuild.
if [ ! -f "$BINARY" ]; then
    echo "[Build] ardurover binary not found — building now (this takes ~5 min)..."
    cd "$ARDUPILOT_DIR"
    python Tools/autotest/sim_vehicle.py \
        -v Rover \
        --frame=motorboat \
        -I 0 \
        --no-mavproxy \
        --build-only
    echo "[Build] Build complete."
else
    echo "[Build] Binary already exists — skipping build."
fi

# ── Step 2: Launch each instance sequentially ──────────────────────────────
for i in $(seq 0 $((NUM_BOATS - 1))); do
    PORT=$((14550 + i * 10))
    LOCATION=${LOCATIONS[$i]}

    # Each instance needs its own directory so EEPROM/logs don't conflict
    INSTANCE_DIR="$HOME/sitl_boat_$i"
    mkdir -p "$INSTANCE_DIR"

    echo "Starting Boat $i on port $PORT at $LOCATION (dir: $INSTANCE_DIR) ..."

    cd "$INSTANCE_DIR"

    # --no-rebuild: skip WAF compilation — binary already built above.
    # --custom-location accepts raw "lat,lon,alt,heading" coordinates.
    "$ARDUPILOT_DIR/Tools/autotest/sim_vehicle.py" \
        -v Rover \
        --frame=motorboat \
        -I "$i" \
        --custom-location="$LOCATION,0,0" \
        --no-mavproxy \
        --speedup=1 \
        --no-rebuild \
        &

    # Instance 0 needs more time to write initial EEPROM params on first run.
    # Instances 1+ only need a few seconds since params are already written.
    if [ "$i" -eq 0 ]; then
        echo "  Waiting 15 s for instance 0 to initialise..."
        sleep 15
    else
        sleep 5
    fi
done

echo ""
echo "All $NUM_BOATS boats launched!"
echo "TCP ports: 5760 (boat 0), 5770 (boat 1), 5780 (boat 2)"
echo "Working dirs: ~/sitl_boat_0, ~/sitl_boat_1, ~/sitl_boat_2"
echo ""
echo "Press Ctrl+C to stop all instances"

wait
