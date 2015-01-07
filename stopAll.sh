#!/bin/bash

# Stop manager
pkill --signal SIGINT lever-manager

# Stop policy server
pkill --signal SIGINT lever-policy

