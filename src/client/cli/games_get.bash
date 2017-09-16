#!/bin/bash

##
## ./games_create.bash
##

source './config.bash'

curl -X 'GET' "${BASE_URL}/games"
