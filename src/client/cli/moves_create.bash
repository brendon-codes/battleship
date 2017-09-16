#!/bin/bash

##
## ./moves_create.bash $(python3 -c 'import uuid; print(str(uuid.uuid4()))')
##

source './config.bash'

curl -X 'POST' "${BASE_URL}/games/${1}/moves"
