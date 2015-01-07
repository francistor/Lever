#!/bin/bash

# Start manager
cd lever/manager
nohup npm start &

# Start policy server
cd ../..
cd lever/policyServer
nohup npm start &

