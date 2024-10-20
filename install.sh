#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

# Variables for paths
INSTALL_DIR="/usr/local/lib/keyvis"
EXECUTABLE="/usr/local/bin/keyvis"
KILL_EXECUTABLE="/usr/local/bin/keyvis-kill"
MAIN_JS="dist/main.js"

# Check if necessary commands are available
command -v bun >/dev/null 2>&1 || {
    echo >&2 "Bun is required but not installed. Aborting."
    exit 1
}
command -v gjs >/dev/null 2>&1 || {
    echo >&2 "GJS is required but not installed. Aborting."
    exit 1
}

# Create directories if they don't exist (using sudo only if necessary)
if [ ! -d "$INSTALL_DIR" ]; then
    echo "Creating $INSTALL_DIR directory..."
    sudo mkdir -p "$INSTALL_DIR"
fi

# Build the project
echo "Building the project..."
bun build:app

# Ensure the compiled JavaScript exists before copying
if [ -f "$MAIN_JS" ]; then
    echo "Copying compiled JavaScript to $INSTALL_DIR..."
    sudo cp "$MAIN_JS" "$INSTALL_DIR/"
else
    echo "Build failed: $MAIN_JS not found."
    exit 1
fi

# Create the executable script for keyvis
echo "Creating the executable script..."
sudo tee "$EXECUTABLE" >/dev/null <<'EOF'
#!/usr/bin/env bash

gjs -m /usr/local/lib/keyvis/main.js "$@"
EOF

# Create the executable script for keyvis-kill
echo "Creating the keyvis-kill executable script..."
sudo tee "$KILL_EXECUTABLE" >/dev/null <<'EOF'
#!/usr/bin/env bash

# Kill existing instances of keyvis
pids=$(pgrep -f keyvis)

if [ -n "$pids" ]; then
    echo "Killing existing instances of keyvis with PIDs: $pids"
    for pid in $pids; do
        kill -9 "$pid"
    done
else
    echo "No running instance of keyvis found."
fi

EOF

# Make the scripts executable
sudo chmod +x "$EXECUTABLE"
sudo chmod +x "$KILL_EXECUTABLE"

echo "KeyVis has been installed successfully."
echo "You can now run it using the 'keyvis' command."
echo "You can also kill the running instance using 'keyvis-kill' command."
