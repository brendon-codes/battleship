#!/usr/bin/env python3

"""
BattleShip Web Service
"""

import os
import sys
import json
import uuid
from pprint import pprint

import numpy as np
from tornado import (
    ioloop as torn_ioloop,
    web as torn_web,
    websocket as torn_ws
)

SRC_ROOT = os.path.realpath(os.path.join(os.path.dirname(__file__), "../../"))
STATIC_ROOT = os.path.realpath(os.path.join(SRC_ROOT, "client/web/"))

GAMES = {}
SESSIONS = {}
SESSION_KEY = "X-Bs-Session-Id"
GRID_SIZE = 10
SHIPS = {
    "carrier": {
        "intcode": 1,
        "length": 5
    },
    "battleship": {
        "intcode": 2,
        "length": 4
    },
    "cruiser": {
        "intcode": 3,
        "length": 3
    },
    "submarine": {
        "intcode": 4,
        "length": 3
    },
    "destroyer": {
        "intcode": 5,
        "length": 2
    }
}
SHIPS_INTCODES = dict(map(lambda s: (s[1]["intcode"], s[0]), SHIPS.items()))
MOVE_HIT = 1
MOVE_MISS = 2


class SessionModel(object):

    id = None
    websocket = None
    in_game = None

    def __init__(self):
        self.id = str(uuid.uuid4())
        self.websocket = None
        self.in_game = False
        return None

    def set_websocket(self, conn):
        self.websocket = conn
        return True

    def remove_websocket(self):
        self.websocket = None
        return True

    def enable_in_game(self):
        self.in_game = True
        return True

    def send_data(self, data):
        if self.websocket is None:
            return False
        self.websocket.send_data(data)
        return True

    @classmethod
    def destroy(cls, session):
        session.websocket = None
        session.in_game = None
        if session.id in SESSIONS:
            del SESSIONS[session.id]
        return True

    @classmethod
    def get_sessions_not_in_games(cls):
        return list(
            filter(
                lambda s: not s.in_game and s.websocket is not None,
                SESSIONS.values()
            )
        )

    @classmethod
    def make_session(cls):
        session = SessionModel()
        SESSIONS[session.id] = session
        return session

    @classmethod
    def find_session(cls, session_id):
        if not session_id in SESSIONS:
            return None
        return SESSIONS[session_id]

    @classmethod
    def notify_sessions_refresh_list(cls):
        sessions = SessionModel.get_sessions_not_in_games()
        for session in sessions:
            session.send_data({
                "action": "refresh_games"
            })
        return True


class ShipModel(object):

    id = None
    hits = None
    sunk = None
    length = None
    intcode = None

    def __init__(self, id_, length, intcode):
        self.id = id_
        self.length = length
        self.intcode = intcode
        self.hits = 0
        self.sunk = False
        return None

    def add_hit(self):
        if self.hits < self.length:
            self.hits += 1
        if self.hits >= self.length:
            self.sunk = True
        return True

    def export(self):
        return {
            "hits": self.hits,
            "sunk": self.sunk,
            "length": self.length,
            "intcode": self.intcode
        }

    @classmethod
    def get_ship_id_by_intcode(cls, intcode):
        return SHIPS_INTCODES[intcode]

    @classmethod
    def make_ship_by_id(cls, ship_id):
        ship_def = SHIPS[ship_id]
        return ShipModel(ship_id, ship_def["length"], ship_def["intcode"])


class PlayerModel(object):

    id = None
    session = None
    moves_map = None
    moves_index = None
    ships = None
    grid = None
    grid_attempts = None
    sunk_all = None

    def __init__(self, session):
        self.id = str(uuid.uuid4())
        self.session = session
        self.moves_index = []
        self.moves_map = {}
        self.ships = {}
        self.grid = np.zeros((GRID_SIZE, GRID_SIZE))
        self.grid_attempts = np.zeros((GRID_SIZE, GRID_SIZE))
        self.sunk_all = False
        return None

    def export(self, this_player_id=None):
        is_this_player = this_player_id == self.id
        return {
            "id": self.id,
            "moves_index": self.moves_index,
            "sunk_all": self.sunk_all,
            "grid_attempts": self.grid.tolist(),
            "grid": self.grid.tolist() if is_this_player else None,
            "ships": (
                list(map(lambda s: s.export(), self.ships))
                if is_this_player
                else None
            )
        }

    def get_moves(self):
        return self.moves_index

    def check_session(self, session):
        return session is not None and session.id == self.session_id

    def has_ship(self, ship_id):
        return (ship_id in self.ships)

    def check_all_ships_added(self):
        return (len(self.ships) == len(SHIPS))

    def add_ship(self, ship_id, coords, orientation):
        if self.has_ship(ship_id):
            return False
        ship = ShipModel.make_ship_by_id(ship_id)
        ship_arr = self.get_ship_arr(ship.length, coords, orientation)
        available = self.is_space_available(ship_arr)
        if not available:
            return False
        self.add_ship_coords_to_grid(ship_arr, ship.intcode)
        self.ships[ship_id] = ship
        return True

    def add_ship_coord_to_grid(self, ship_arr, ship_intit):
        ship_arr.fill(ship_intit)
        return True

    def is_space_available(self, ship_arr):
        return (len(filter(lambda k: k > 0, ship_arr)) == 0)

    def get_ship_arr(self, ship_len, coords, orientation):
        x, y = coords
        if orientation == "x":
            return self.grid[y][x:(x + ship_len)]
        if orientation == "y":
            return self.grid[y:(y + ship_len),x]
        return None

    def parse_ship_coords(coords_code):
        parts = move_code.split("-")
        if len(parts) != 3:
            return False
        try:
            x = int(parts[0])
            y = int(parts[1])
        except ValueError:
            return False
        orientation = parts[2]
        if orientation not in ["x", "y"]:
            return False
        return ((x, y), orientation)

    def parse_move(self, move_code):
        parts = move_code.split("-")
        if len(parts) != 2:
            return None
        try:
            x = int(parts[0])
            y = int(parts[1])
        except ValueError:
            return None
        return (x, y)

    def get_ship_at_coords(self, coords):
        x, y = coords
        intcode = self.grid[y][x]
        if intcode == 0:
            return None
        ship_id = ShipModel.get_ship_id_by_intcode(intcode)
        ship = self.ships[ship_id]
        return ship

    def add_grid_attempt(self, is_hit, coords):
        x, y = coords
        code = MOVE_HIT if is_hit else MOVE_MISS
        self.grid_attempts[y][x] = code
        return True

    def is_sunk_all(self):
        return (len(list(filter(lambda s: not s.sunk, self.ships))) == 0)

    def register_hit(self, coords):
        """
        `move` is an (x, y) tuple
        """
        if not self.check_all_ships_added():
            return (False, None, "not_all_ships_added")
        if self.sunk_all:
            return (False, None, "all_ships_already_sunk")
        ship = self.get_ship_at_coords(coords)
        is_hit = (ship is not None)
        self.add_grid_attempt(is_hit, coords)
        self.moves_map[coords] = True
        self.moves_index.append(self.moves_map[coords])
        if not is_hit:
            return (
                True,
                {
                    "hit": False,
                    "sunk": None,
                    "sunk_all": False
                },
                None
            )
        ship.add_hit()
        if self.is_sunk_all():
            self.sunk_all = True
        return (
            True,
            {
                "hit": True,
                "sunk": ship.sunk,
                "sunk_all": self.sunk_all
            },
            None
        )


class GameModel(object):

    id = None
    players = None
    game_status = None
    win_player = None

    def __init__(self):
        self.id = str(uuid.uuid4())
        self.players = {}
        game_status = None
        win_player = None
        return None

    def add_player(self, session):
        if len(self.players) >= 2:
            return None
        player = PlayerModel(session)
        self.players[player.id] = player
        self.game_status = True
        session.enable_in_game()
        SessionModel.notify_sessions_refresh_list()
        self.notify_players_refresh_game()
        return player

    def notify_players_refresh_game(self):
        for player in self.players.values():
            player.session.send_data({
                "action": "refresh_game"
            })
        return True

    def export(self, this_player_id=None):
        opposing_player = self.get_opposing_player(this_player_id)
        return {
            "id": self.id,
            "game_status": self.game_status,
            "win_player": self.win_player,
            "players": (
                dict(
                    map(
                        lambda p: (p.id, p.export(this_player_id)),
                        self.players.values()
                    )
                )
            ),
            "player_id_you": this_player_id,
            "player_id_opponent": (
                None
                if opposing_player is None
                else opposing_player.id
            )
        }

    def get_player_by_session_id(self, session_id):
        players = (
            list(
                filter(
                    lambda p: (
                        p.session is not None and
                        p.session.id == session_id
                    ),
                    self.players.values()
                )
            )
        )
        if len(players) == 0:
            return None
        return players[0]

    def has_player(self, player_id):
        return (player_id in self.players)

    def get_player(self, player_id):
        return (self.players[player_id])

    def get_opposing_player(self, this_player_id):
        other_players = (
            list(
                filter(
                    lambda p: p[0] != this_player_id,
                    self.players.items()
                )
            )
        )
        #pprint(other_players)
        if len(other_players) == 0:
            return None
        return other_players[0][1]

    def make_move(self, this_player, coords):
        oppose_player = self.get_opposing_player(this_player.id)
        if oppose_player is None:
            return (False, None, "no_opposing_player")
        hit_status, hit_data, hit_msg = oppose_player.register_hit(coords)
        if not hit_status:
            return (False, None, msg)
        if oppose_player.sunk_all:
            self.register_winner(player)
        return (True, hit_data, None)

    def register_winner(player):
        self.game_status = False
        self.win_player = player
        return True

    @classmethod
    def game_exists(cls, game_id):
        return (game_id in GAMES)

    @classmethod
    def get_game_by_id(cls, game_id):
        if game_id not in GAMES:
            return None
        return GAMES[game_id]

    @classmethod
    def create_game_from_id(cls):
        game = GameModel()
        GAMES[game.id] = game
        return game

    @classmethod
    def get_joinable_games(cls):
        return (
            list(
                filter(
                    lambda g: (
                        (len(g.players) < 2) and
                        (g.game_status is not False)
                    ),
                    GAMES.values()
                )
            )
        );


class BaseWebHandler(torn_web.RequestHandler):

    def get_session(self):
        if SESSION_KEY not in self.request.headers:
            return None
        sess_id_header = self.request.headers[SESSION_KEY]
        session = SessionModel.find_session(sess_id_header)
        if session is None:
            return None
        return session

    def response(self, body_obj=None, status=200, code="ok", headers=None):
        self.set_status(status)
        self.set_header("Content-Type", "application/json")
        if headers is not None:
            for key, val in headers:
                self.set_header(key, val)
        self.write(json.dumps({
            "code": code,
            "data": body_obj
        }))
        return None


class SessionsHandler(BaseWebHandler):

    def post(self):
        session = SessionModel.make_session()
        return self.response(
            None,
            headers=[(SESSION_KEY, session.id)]
        )


class GamesHandler(BaseWebHandler):

    def post(self):
        session = self.get_session()
        if session is None:
            return self.response(None, 401, "no_session_id")
        game = GameModel.create_game_from_id()
        player = game.add_player(session)
        exported = game.export(player.id)
        return self.response(
            exported,
            headers=[(SESSION_KEY, player.session.id)]
        )

    def get(self):
        games = GameModel.get_joinable_games()
        out = list(map(lambda g: g.export(), games))
        return self.response(out)


class GameHandler(BaseWebHandler):

    def get(self, game_id):
        """
        Gets status for current game
        """
        game = GameModel.get_game_by_id(game_id)
        if game is None:
            return self.response(None, 404, "game_not_found")
        session = self.get_session()
        if session is None:
            return self.response(None, 401, "no_session_id")
        player = game.get_player_by_session_id(session.id)
        exported = game.export(player.id)
        return self.response(exported)


class PlayersHandler(BaseWebHandler):

    def post(self, game_id):
        """
        Allows a user to join an existing game
        """
        if not GameModel.game_exists(game_id):
            return self.response(None, 404, "game_not_found")
        game = GameModel.get_game_by_id(game_id)
        session = self.get_session()
        if session is None:
            return self.response(None, 401, "no_session_id")
        player = game.add_player(session)
        if player is None:
            return self.response(None, 401, "max_players_already_joined")
        exported = game.export(player.id)
        return self.response(exported)


class MovesHandler(BaseWebHandler):

    def put(self, game_id, player_id, move_code):
        game = GameModel.get_game_by_id(game)
        if game is None:
            return self.response(None, 404, "game_not_found")
        player = game.get_player(player_id)
        if player is None:
            return self.response(None, 403, "player_id_not_specified")
        session = self.get_session()
        if session is None:
            return self.response(None, 403, "no_session")
        if not player.check_session(session.id):
            return self.response(None, 403, "player_session_not_authorized")
        coords = player.parse_move(move_code)
        if coords is None:
            return self.response(None, 404, "bad_move")
        move_status, move_data, move_msg = game.make_move(player, coords)
        if not move_status:
            return self.response(None, 404, move_msg)
        return self.response(move_data)


class ShipsHandler(BaseWebHandler):

    def put(self, game_id, player_id, ship_id, coords_code):
        game = GameModel.get_game_by_id(game)
        if game is None:
            return self.response(None, 404, "game_not_found")
        player = game.get_player(player_id)
        if player is None:
            return self.response(None, 403, "player_id_not_specified")
        session = self.get_session()
        if session is None:
            return self.response(None, 403, "no_session")
        if not player.check_session(session.id):
            return self.response(None, 403, "player_session_not_authorized")
        coords, orientation = player.parse_ship_coords(coords_code)
        if not coords:
            return self.response(None, 404, "bad_ship_coords")
        ship_status = player.add_ship(ship_id, coords, orientation)
        if not ship_status:
            return self.response(None, 404, "bad_ship_coords")
        return self.response()


class BaseWsHandler(torn_ws.WebSocketHandler):

    session = None

    def check_origin(self, origin):
        return True

    def open(self, session_id):
        print("HEY: %s" % session_id)
        session = SessionModel.find_session(session_id)
        if session is None:
            self.close()
            return None
        self.session = session
        self.session.set_websocket(self)
        return None

    def send_data(self, data):
        self.write_message(json.dumps(data))
        return True

    def on_message(self, message):
        self.write_message("MESSAGE: %s" % message)
        return None

    def on_close(self):
        SessionModel.destroy(self.session)
        return None


def make_app():
    return (
        torn_web.Application([
            ##
            ## This is the Websocket route
            ##
            (
                r"/ws/([A-Za-z0-9-]{36})",
                BaseWsHandler,
            ),
            ##
            ## These are all API routes
            ##
            (
                r"/api/sessions",
                SessionsHandler
            ),
            (
                r"/api/games",
                GamesHandler
            ),
            (
                r"/api/games/([A-Za-z0-9-]{36})",
                GameHandler
            ),
            (
                r"/api/games/([A-Za-z0-9-]{36})/players",
                PlayersHandler
            ),
            (
                r"/api/games/([A-Za-z0-9-]{36})"
                r"/players/([A-Za-z0-9-]{32})/ships/%(SHIPS)s"
                r"/([0-9]{1,2}-[0-9]{1,2}-[xy])" %
                {
                    "SHIPS": r"|".join(SHIPS.keys())
                },
                ShipsHandler
            ),
            (
                r"/api/games/([A-Za-z0-9-]{36})"
                r"/players/([A-Za-z0-9-]{32})/moves/([0-9]{1,2}-[0-9]{1,2})",
                MovesHandler
            ),
            ##
            ## These are static file routes
            ##
            (
                r"/(.*)",
                torn_web.StaticFileHandler,
                {
                    "default_filename": "index.html",
                    "path": STATIC_ROOT
                }
            )
        ])
    )


def main():
    app = make_app()
    app.listen(8888)
    torn_ioloop.IOLoop.current().start()
    return True


if __name__ == "__main__":
    main()
    sys.exit(0)
