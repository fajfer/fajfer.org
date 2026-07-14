#!/bin/bash

# Check if a directory was provided, otherwise default to the current directory
TARGET_DIR="${1:-.}"

# Ensure the directory exists
if [ ! -d "$TARGET_DIR" ]; then
    echo "Error: Directory '$TARGET_DIR' does not exist."
    exit 1
fi

echo "Checking images in '$TARGET_DIR' for Open Badge credentials..."
echo "------------------------------------------------"

# Find and loop through common image formats (case-insensitive)
find "$TARGET_DIR" -maxdepth 1 -type f \( -iname "*.png" -o -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.svg" \) | while read -r img; do
    
    # Run exiftool and capture the output (silencing errors)
    credential=$(exiftool -b -openbadgecredential "$img" 2>/dev/null)
    
    # Check if the output is non-empty
    if [ -n "$credential" ]; then
        echo "[ BADGE ] : $(basename "$img")"
    else
        echo "[  NO   ] : $(basename "$img")"
    fi
done