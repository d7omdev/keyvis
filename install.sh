#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

# Variables for paths
INSTALL_DIR="/usr/local/lib/keyvis"
EXECUTABLE="/usr/local/bin/keyvis"
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

if [ $# -eq 0 ]; then
    gjs -m /usr/local/lib/keyvis/main.js > /dev/null 2>&1 &
else
    gjs -m /usr/local/lib/keyvis/main.js "$@"
fi
EOF

# Make the scripts executable
sudo chmod +x "$EXECUTABLE"

echo "KeyVis has been installed successfully."
echo "You can now run it using the 'keyvis' command."
