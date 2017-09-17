#!/bin/bash

##
## Python setup
##
rm -rf ./env/
mkdir ./env/
python3 -m venv ./env/
./env/bin/pip3 install -r ./requirements.txt

##
## Node setup
##
rm -rf ./node_modules/
npm install
./webpack

