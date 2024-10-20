#!/usr/bin/env bash

# Remove the executables
sudo rm -f /usr/local/bin/keyvis
sudo rm -f /use/local/bin/keyvis-kill

# Remove the application files
sudo rm -rf /usr/local/lib/keyvis

echo "KeyVis has been uninstalled."
