#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

# Variables for paths
INSTALL_DIR="/usr/local/lib/keyvis"
EXECUTABLE="/usr/local/bin/keyvis"
MAIN_JS="dist/main.js"

# Color definitions for messages
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Helper function for error messages
error() {
    echo -e "${RED}$1${NC}"
    exit 1
}

# Check if necessary commands are available
command -v bun >/dev/null 2>&1 || error "Bun is required but not installed. Aborting."
command -v gjs >/dev/null 2>&1 || error "GJS is required but not installed. Aborting."

# Ensure INSTALL_DIR exists, create if not
if [ ! -d "$INSTALL_DIR" ]; then
    echo "Creating $INSTALL_DIR directory..."
    sudo mkdir -p "$INSTALL_DIR" || error "Failed to create $INSTALL_DIR."
fi

# Install dependencies if they are missing
echo "Installing dependencies..."
bun install || error "Failed to install dependencies."

# Check if bun build script exists in package.json
if ! bun run build:app >/dev/null 2>&1; then
    error "'build:app' script not found in package.json. Aborting."
fi

# Build the project
echo "Building the project..."
bun run build:app || error "Build failed. Please check your build configuration."

# Verify if main.js was generated successfully
if [ -f "$MAIN_JS" ]; then
    echo "Copying compiled JavaScript to $INSTALL_DIR..."
    sudo cp "$MAIN_JS" "$INSTALL_DIR/" || error "Failed to copy $MAIN_JS to $INSTALL_DIR."
else
    error "Build failed: $MAIN_JS not found."
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

# Make the script executable
sudo chmod +x "$EXECUTABLE" || error "Failed to make $EXECUTABLE executable."

echo -e "${GREEN}KeyVis has been installed successfully.${NC}"
echo "You can now run it using the 'keyvis' command."
