
"use strict";

import $ from "jquery";
import React from "react";
import ReactDom from "react-dom";

import Styles from "./battleship.css";

const MOVE_HIT = 1;
const MOVE_MISS = 2;


class Battleship extends React.Component {

  constructor(props: Object, context: Object) {
    super(props, context);
    this.setDefaultState();
  }

  setDefaultState () {
    this.state = this.buildDefaultState();
    return true;
  }

  buildDefaultState (): Object {
    return {
      placeShip: null,
      websocket: null,
      sessionId: null,
      game: null,
      allGames: null
    }
  }

  renderLoading () {
    return (
      <div>
        Loading...
      </div>
    );
  }

  render () {
    if (this.state.sessionId === null) {
      return this.renderLoading();
    }
    if (this.state.websocket === null) {
      return this.renderLoading();
    }
    if (this.state.game === null) {
      return this.renderShowGames();
    }
    return this.renderGame();
  }

  renderOpponentPlayerHeader () {
    const oppPlayer = this.getOpponentPlayer();
    if (oppPlayer !== null) {
      return (
        <span>{oppPlayer.id}</span>
      );
    }
    return (
      <span>
        WAITING FOR PLAYER TO JOIN.
      </span>
    );
  }

  renderGameHeader () {
    const youPlayer = this.getYouPlayer();
    return (
      <div>
        <ul>
          <li>Game: {this.state.game.id}</li>
          <li>You Player: {(youPlayer === null) ? "NONE" : youPlayer.id}</li>
          <li>Opponent Player: {this.renderOpponentPlayerHeader()}</li>
        </ul>
      </div>
    );
  }

  renderGameResults () {
    const youPlayer = this.getYouPlayer();
    if (this.state.game.game_status === true) {
      const turnMsg = (
        youPlayer.is_turn ?
          "IT IS YOUR TURN" :
          "IT IS YOUR OPPONENT'S TURN"
      );
      return (
        <div>
          <h2>{turnMsg}</h2>
        </div>
      );
    }
    const winPlayerId = this.state.game.player_id_winner;
    const msg = (winPlayerId === youPlayer.id ? "YOU WON!" : "YOU LOST!");
    return (
      <div>
        <h2>{msg} GAME OVER!</h2>
      </div>
    );
  }

  getOpponentPlayer () {
    if (this.state.game == null) {
      return null;
    }
    if (this.state.game.player_id_opponent === null) {
      return null
    }
    return this.state.game.players[this.state.game.player_id_opponent];
  }

  getYouPlayer () {
    if (this.state.game == null) {
      return null;
    }
    if (this.state.game.player_id_you === null) {
      return null
    }
    return this.state.game.players[this.state.game.player_id_you];
  }

  renderGame () {
    return (
      <div>
        {this.renderGameHeader()}
        {this.renderGameResults()}
        {this.renderGameBody()}
      </div>
    );
  }

  getYouPlayer () {
    return this.state.game.players[this.state.game.player_id_you];
  }

  renderGameYourGrid () {
    const youPlayer = this.getYouPlayer();
    const grid = youPlayer.grid;
    return (
      <table className="grid">
        <tbody>
          {grid.map(this.renderGameYourGridRow.bind(this))}
        </tbody>
      </table>
    );
  }

  renderGameYourGridRow (row, y) {
    return (
      <tr key={y}>
        {row.map(this.renderGameYourGridCell.bind(this, y))}
      </tr>
    );
  }

  renderGameOppGridRow (row, y) {
    return (
      <tr key={y}>
        {row.map(this.renderGameOppGridCell.bind(this, y))}
      </tr>
    );
  }

  handleClickYourGridCell (coords, evt) {
    const youPlayer = this.getYouPlayer();
    $.ajax({
      type: "PUT",
      url: this.buildUrl([
        "api",
        "games",
        this.state.game.id,
        "players",
        youPlayer.id,
        "ships",
        this.state.placeShip.ship.id,
        [
          coords[0].toString(),
          coords[1].toString(),
          this.state.placeShip.orientation
        ].join("-")
      ]),
      dataType: "json",
      contentType: "application/json",
      beforeSend: (req) => {
        req.setRequestHeader("X-Bs-Session-Id", this.state.sessionId);
        return true;
      },
      complete: (xhr, status) => {
        const resp = xhr.responseJSON;
        if (resp.code === "bad_ship_coords") {
          window.alert("You cannot put a ship in that location.");
        }
        this.setState(
          {
            placeShip: null
          },
          () => {
            this.loadDataGame();
          }
        );
        return true;
      },
    })
    evt.preventDefault();
    return false;
  }

  handleClickOppGridCell (coords, evt) {
    const youPlayer = this.getYouPlayer();
    if (!youPlayer.is_turn) {
      window.alert("It is not your turn!");
      evt.preventDefault();
      return false;
    }
    $.ajax({
      type: "PUT",
      url: this.buildUrl([
        "api",
        "games",
        this.state.game.id,
        "players",
        youPlayer.id,
        "moves",
        [
          coords[0].toString(),
          coords[1].toString()
        ].join("-")
      ]),
      dataType: "json",
      contentType: "application/json",
      beforeSend: (req) => {
        req.setRequestHeader("X-Bs-Session-Id", this.state.sessionId);
        return true;
      },
      success: (resp, status, xhr) => {
        this.loadDataGame();
        return true;
      }
    })
    evt.preventDefault();
    return false;
  }

  getGridHit (coords) {
    const youPlayer = this.getYouPlayer();
    const gridHits = youPlayer.grid_attempts;
    const [x, y] = coords;
    const row = gridHits[y];
    const cell = row[x];
    return cell;
  }

  renderGameYourGridCell (y, cell, x) {
    const ship = this.getAvailShipByIntcode(cell);
    const gridHitVal = this.getGridHit([x, y]);
    const val = ship === null ? " " : ship.id.substr(0, 3);
    const coords = [x, y];
    const extras = {};
    const className = (() => {
      if (gridHitVal === MOVE_HIT) {
        return "gridCellHit";
      }
      if (gridHitVal === MOVE_MISS) {
        return "gridCellMiss";
      }
      return "";
    })();
    if (this.state.placeShip !== null) {
      extras.onClick = this.handleClickYourGridCell.bind(this, coords);
    }
    return (
      <td key={x} className={className} {...extras}>
        {val}
      </td>
    );
  }

  renderGameOppGridCell (y, cell, x) {
    const coords = [x, y];
    const extras = {};
    const className = (() => {
      if (cell === MOVE_HIT) {
        return "gridCellHit";
      }
      if (cell === MOVE_MISS) {
        return "gridCellMiss";
      }
      return "";
    })();
    if (this.state.game.game_status === true) {
      extras.onClick = this.handleClickOppGridCell.bind(this, coords);
    }
    return (
      <td key={x} className={className} {...extras}>
        &nbsp;
      </td>
    );
  }

  renderGameBodyYourGrid () {
    return (
      <div className="yourGrid">
        <h3>Your Zone</h3>
        {this.renderGameYourGrid()}
      </div>
    );
  }

  renderGameBodyOppGrid () {
    const oppPlayer = this.getOpponentPlayer();
    const grid = oppPlayer.grid_attempts;
    return (
      <div className="oppGrid">
        <h3>Opponent Zone</h3>
        <table className="grid">
          <tbody>
            {grid.map(this.renderGameOppGridRow.bind(this))}
          </tbody>
        </table>
      </div>
    );
  }

  getPlayerAvailShips () {
    const allAvailShips = this.state.game.all_avail_ships;
    return allAvailShips;
  }

  getAvailShipByIntcode (intcode) {
    if (intcode === 0) {
      return null;
    }
    const allAvailShips = this.getPlayerAvailShips();
    const ships = allAvailShips.filter((ship) => ship.intcode === intcode);
    if (ships.length === 0) {
      return null;
    }
    return ships[0];
  }

  isShipOnBoard (shipId) {
    const youPlayer = this.getYouPlayer();
    const youShips = youPlayer.ships.map((ship) => ship.id);
    const onBoard = (youShips.indexOf(shipId) !== -1);
    return onBoard;
  }

  handleClickShipOrient (ship, orientation, evt) {
    this.setState({
      placeShip: {
        ship: ship,
        orientation: orientation
      },
    });
    evt.preventDefault();
    return false;
  }

  isSelectedPlacementShip (shipId) {
    return (
      this.state.placeShip !== null &&
        this.state.placeShip.ship.id === shipId
    );
  }

  getYouPlayerShipFromShipId (shipId) {
    const youPlayer = this.getYouPlayer();
    const youShips = youPlayer.ships.filter((ship) => ship.id === shipId);
    if (youShips.length === 0) {
      return null;
    }
    return youShips[0];
  }

  getOppPlayerShipFromShipId (shipId) {
    const oppPlayer = this.getOpponentPlayer();
    const oppShips = oppPlayer.ships.filter((ship) => ship.id === shipId);
    if (oppShips.length === 0) {
      return null;
    }
    return oppShips[0];
  }

  renderGameBodyYourShip (ship) {
    const playerShip = this.getYouPlayerShipFromShipId(ship.id);
    const isSunk = (playerShip !== null && playerShip.sunk);
    const shipOnBoard = this.isShipOnBoard(ship.id);
    const shipSelected = this.isSelectedPlacementShip(ship.id);
    const className = (() => {
      if (isSunk) {
        return "shipIsSunk";
      }
      if (shipOnBoard) {
        return "shipIsOnBoard";
      }
      if (shipSelected) {
        return "selectedPlacementShip";
      }
      return "";
    })();
    const actions = (() => {
      if (shipOnBoard) {
        return (
          <span>&nbsp;</span>
        );
      }
      return (
        <div>
          <a
              href="#"
              onClick={this.handleClickShipOrient.bind(this, ship, "x")}>
            Horizontal
          </a>
          &nbsp;|&nbsp;
          <a
              href="#"
              onClick={this.handleClickShipOrient.bind(this, ship, "y")}>
            Vertical
          </a>
        </div>
      );
    })();
    return (
      <tr key={ship.id} className={className}>
        <td>
          {actions}
        </td>
        <td>
          {ship.id}
        </td>
        <td>
          {ship.length}
        </td>
      </tr>
    );
  }

  renderGameBodyOppShip (ship) {
    const playerShip = this.getOppPlayerShipFromShipId(ship.id);
    const isSunk = (playerShip !== null && playerShip.sunk);
    const className = (() => {
      if (isSunk) {
        return "shipIsSunk";
      }
      return "";
    })();
    return (
      <tr key={ship.id} className={className}>
        <td>
          {ship.id}
        </td>
        <td>
          {ship.length}
        </td>
      </tr>
    );
  }

  renderGameBodyOppShips () {
    const availShips = this.getPlayerAvailShips();
    return (
      <div className="oppShips">
        <h3>Opponent Ships</h3>
        <ol>
          <li>
            To attack your opponent, click a cell on the Opponent Zone grid.
          </li>
        </ol>
        <table className="ships">
          <thead>
            <tr>
              <td>Name</td>
              <td>Size</td>
            </tr>
          </thead>
          <tbody>
            {availShips.map(this.renderGameBodyOppShip.bind(this))}
          </tbody>
        </table>
      </div>
    );
  }

  renderGameBodyYourShips () {
    const availShips = this.getPlayerAvailShips();
    return (
      <div className="yourShips">
        <h3>Your Ships</h3>
        <ol>
          <li>Select a ship and ship orientation</li>
          <li>Click the cell on the grid where you want to place the ship</li>
        </ol>
        <table className="ships">
          <thead>
            <tr>
              <td>Select</td>
              <td>Name</td>
              <td>Size</td>
            </tr>
          </thead>
          <tbody>
            {availShips.map(this.renderGameBodyYourShip.bind(this))}
          </tbody>
        </table>
      </div>
    );
  }

  renderGameBody () {
    return (
      <div>
        {this.renderGameBodyYour()}
        {this.renderGameBodyOpp()}
      </div>
    )
  }

  renderGameBodyOpp () {
    const oppPlayer = this.getOpponentPlayer();
    if (oppPlayer === null) {
      return [];
    }
    if (!oppPlayer.all_ships_added) {
      return (
        <div>
          <em>
            Opponent is still adding ships.
            When opponent has added all ships,
            you will be able to specify attacks on
            a grid here.  Waiting...
          </em>
        </div>
      );
    }
    return (
      <div>
         {this.renderGameBodyOppGrid()}
         {this.renderGameBodyOppShips()}
         <div className="clear"></div>
      </div>
    );
  }

  renderGameBodyYour () {
    return (
      <div>
        {this.renderGameBodyYourGrid()}
        {this.renderGameBodyYourShips()}
        <div className="clear"></div>
      </div>
    );
  }

  renderShowGames () {
    if (this.state.allGames === null) {
      return (
        <div>
          Loading games...
        </div>
      );
    }
    return (
      <div>
        {this.renderInitGameActions()}
        {this.renderListGames()}
      </div>
    );
  }

  renderListGames () {
    if (this.state.allGames.length === 0) {
      return (
          <div>
            <em>
              No games are available. Waiting for
              games to start...
            </em>
          </div>
      );
    }
    //console.log(this.state.allGames);
    return (
      <div>
        <div>
          Or, join one of these games...
        </div>
        <ul>
          {this.state.allGames.map((game) =>
            <li key={game.id}>
              <a href="#" onClick={this.handleClickJoinGame.bind(this, game)}>
                Join {game.id}
              </a>
            </li>
          )}
        </ul>
      </div>
    );
  }

  renderInitGameActions () {
    return (
      <div>
        <div>
          <a href="#" onClick={this.handleClickStartGame.bind(this)}>
            CLICK HERE TO START NEW GAME
          </a>
        </div>
      </div>
    );
  }

  handleClickStartGame (evt) {
    $.ajax({
      type: "POST",
      url: this.buildUrl(["api", "games"]),
      dataType: "json",
      contentType: "application/json",
      beforeSend: (req) => {
        req.setRequestHeader("X-Bs-Session-Id", this.state.sessionId);
        return true;
      },
      success: (resp, status, xhr) => {
        this.setGame(resp.data);
        return true;
      }
    })
    evt.preventDefault();
    return false;
  }

  buildUrl (parts) {
    const path: string = ["", ...parts].join("/");
    return path;
  }

  setGame(game) {
    this.setState({
      game: game
    });
    return true;
  }

  handleClickJoinGame (game, evt) {
    $.ajax({
      type: "POST",
      url: this.buildUrl(["api", "games", game.id, "players"]),
      dataType: "json",
      contentType: "application/json",
      beforeSend: (req) => {
        req.setRequestHeader("X-Bs-Session-Id", this.state.sessionId);
        return true;
      },
      success: (resp, status, xhr) => {
        this.setGame(resp.data);
        return true;
      }
    });
    evt.preventDefault();
    return false;
  }

  loadDataGame () {
    $.ajax({
      type: "GET",
      url: this.buildUrl(["api", "games", this.state.game.id]),
      dataType: "json",
      contentType: "application/json",
      beforeSend: (req) => {
        req.setRequestHeader("X-Bs-Session-Id", this.state.sessionId);
        return true;
      },
      success: (resp) => {
        this.setState({
          game: resp.data
        });
        return true;
      }
    });
    return true;
  }

  loadDataAllGames () {
    $.ajax({
      type: "GET",
      url: this.buildUrl(["api", "games"]),
      dataType: "json",
      contentType: "application/json",
      beforeSend: (req) => {
        req.setRequestHeader("X-Bs-Session-Id", this.state.sessionId);
        return true;
      },
      success: (resp) => {
        this.setState({
          allGames: resp.data
        });
        return true;
      }
    });
    return true;
  }

  loadDataSession () {
    const sessId = window.localStorage.getItem("session_id");
    const [method, url] = (() => {
      if (sessId !== null && sessId !== undefined) {
        return [
          "GET",
          this.buildUrl(["api", "sessions", sessId])
        ];
      }
      return [
        "POST",
        this.buildUrl(["api", "sessions"])
      ];
    })();
    $.ajax({
      type: method,
      url: url,
      dataType: "json",
      contentType: "application/json",
      success: (resp, status, xhr) => {
        this.setState(
          {
            sessionId: xhr.getResponseHeader("X-Bs-Session-Id")
          },
          () => {
            window.localStorage.setItem("session_id", this.state.sessionId)
            this.loadDataWebsocket();
            return true;
          }
        );
        return true;
      }
    });
    return true;
  }

  handleWsRefreshGames () {
    this.loadDataAllGames();
    return true;
  }

  handleWsRefreshGame () {
    if (this.state.game === null) {
      return false
    }
    this.loadDataGame();
    return true;
  }

  handleWsMessage (data) {
    if (data.action === "refresh_games") {
      this.handleWsRefreshGames();
      return true;
    }
    if (data.action === "refresh_game") {
      this.handleWsRefreshGame();
      return true;
    }
    return true;
  }

  loadDataWebsocket () {
    const url = ["ws:/", location.host, "ws", this.state.sessionId].join("/");
    const ws = new WebSocket(url);
    ws.onmessage = (evt) => {
      this.handleWsMessage(JSON.parse(evt.data));
      return true;
    };
    ws.onopen = () => {
      this.setState(
        {
          websocket: ws
        },
        () => {
          this.loadDataAllGames();
          return true;
        }
      );
      return true;
    };
    return true;
  }

  loadInitialData () {
    this.loadDataSession();
    return true;
  }

  componentWillMount () {
    this.loadInitialData();
    return true;
  }

};


const setup = function () {
  $(document).ready(init);
  return true;
};


const init = function () {
  ReactDom.render(<Battleship />, $("#root")[0]);
  return true;
};


setup();
