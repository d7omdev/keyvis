#!/usr/bin/env bash

# Paths
INSTALL_DIR="/usr/local/lib/keyvis"
EXECUTABLE="/usr/local/bin/keyvis"

echo "Starting KeyVis uninstallation..."

uninstalled=false

# Check if the executable exists and remove it
if [ -f "$EXECUTABLE" ]; then
    echo "Removing KeyVis executable from $EXECUTABLE..."
    sudo rm -f "$EXECUTABLE"
    echo "Executable removed successfully."
    uninstalled=true
else
    echo "KeyVis executable not found at $EXECUTABLE. Skipping removal."
fi

# Check if the application directory exists and remove it
if [ -d "$INSTALL_DIR" ]; then
    echo "Removing KeyVis application files from $INSTALL_DIR..."
    sudo rm -rf "$INSTALL_DIR"
    echo "Application files removed successfully."
    uninstalled=true
else
    echo "KeyVis directory not found at $INSTALL_DIR. Skipping removal."
fi

# Final message if something was uninstalled
if [ "$uninstalled" = true ]; then
    echo "KeyVis has been uninstalled successfully."
else
    echo "Nothing to uninstall. KeyVis was not found."
fi
