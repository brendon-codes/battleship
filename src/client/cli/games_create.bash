#!/bin/bash

##
## ./games_create.bash
##

source './config.bash'

curl -X 'POST' "${BASE_URL}/games"
