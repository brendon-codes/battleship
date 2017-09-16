#!/bin/bash

##
## ./game_get.bash $(python3 -c 'import uuid; print(str(uuid.uuid4()))')
##

source './config.bash'

curl -X 'GET' "${BASE_URL}/games/${1}"
