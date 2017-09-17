# BattleShip Web Application

Author: Brendon Crawford <brendon@aphex.io>


## About

This is a simple web application which allows users
to play BattleShip.

The server is built on top of Python Tornado.
Tornado is good for this because it allows a single process to handle
all connections, which can also be shared with built in Websocket support.
So, this makes it very easy to build quick web service APIs, and send
Websocket messages to clients, without depending on other external infrastructure.

The client is built with ReactJS.  JS dependencies are kept to a minimum.

This application has no comments, and no tests.  With more time, it would
have been a good idea to add those.


## Requirements

- Git
- Only tested on Fedora 26, but maybe works on newer Ubuntu.
- Python 3.6+: I don't think this currently is included with the
  current Ubuntu LTS.  You might need newer Ubuntu.
- NodeJS LTS: This was only tested on Node 6.11.0


## Setup

```bash
git clone $REPO_URL
cd battleship/
./setup.bash
```


## Running

Start the server and go.

```bash
./start_server.bash
```

## Development

Start the server.  Manually restart it after Python code changes.
Run `./webpack --watch` to rebuild JS code.


## Playing

First, make sure you start the server.  The server will listen
on port 888.

You can play with two different users on the same host, but
you must use 2 different browsers.  If you try to open 2 tabs/windows
in the same browser, they will just use the same session id, and be assumed
to be the same user.

1. Player1 goes to http://localhost:8888/
2. Player2 goes to http://localhost:8888/
3. Player1 clicks "CLICK HERE TO START NEW GAME".
4. Player2 should now see the game in the game listing.
5. Player2 clicks the game to join the game that was created by Player1
6. Both players add ships to their zone:
   1. Player clicks on either "Horizontal" or "Vertical" to select a ship to add.
   2. Player then clicks in a cell in the "Your Zone" grid to add the ship to that coordinate.
7. Once both players have added all ships, they can attack their opponent (in turns)
   1. Player clicks a cell in the "Opponent Zone" grid
8. Once all ships have been sunk, game will be over.

