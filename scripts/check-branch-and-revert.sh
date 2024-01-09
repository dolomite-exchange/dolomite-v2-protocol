#!/bin/bash

current_branch=$(git rev-parse --abbrev-ref HEAD)

if [ "$current_branch" != "v2" ]; then
    echo "Error: Not on the 'v2' branch."
    exit 1;
fi
