
"use strict";

import $ from "jquery";
import React from "react";
import ReactDom from "react-dom";


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
      url: "/api/games",
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
    $.ajax({
      type: "POST",
      url: this.buildUrl(["api", "sessions"]),
      dataType: "json",
      contentType: "application/json",
      success: (resp, status, xhr) => {
        this.setState(
          {
            sessionId: xhr.getResponseHeader("X-Bs-Session-Id")
          },
          () => {
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

  // loadData (): boolean {
  //   this.ajax({
  //     url: this.buildUrl(["api", "organizations"]),
  //     method: "GET",
  //     dataType: "json",
  //     success: (resp: any): boolean => {
  //       this.setState({
  //         orgs: resp
  //       });
  //       return true;
  //     }
  //   });
  //   return true;
  // }

  // buildUrlSettings (orgId) {
  //   return (
  //     this.buildUrl([
  //       "dash",
  //       "organizations",
  //       orgId
  //     ])
  //   );
  // }

  // buildUrlSecGroups (orgId) {
  //   return (
  //     this.buildUrl([
  //       "dash",
  //       "organizations",
  //       orgId,
  //       "security-groups"
  //     ])
  //   );
  // }

  // render (): Object {
  //   if (this.state.orgs === null) {
  //     return (
  //       <div data-component={this.getComponentName()}>
  //         Loading...
  //       </div>
  //     );
  //   }
  //   return this.renderOrgs();
  // }

  // renderOrgs (): Object {
  //   return (
  //     <div data-component={this.getComponentName()}>
  //       <div>
  //         <a href="/dash/organizations:create">Add a new Organization.</a>
  //       </div>
  //       <table className="table">
  //         <thead>
  //           <tr>
  //             <td>Name</td>
  //             <td>ARN</td>
  //             <td>Joined Date</td>
  //             <td>&nbsp;</td>
  //             <td>&nbsp;</td>
  //           </tr>
  //         </thead>
  //         <tbody>
  //           {
  //             this.state.orgs.map(
  //               org =>
  //                 <tr key={org.id["@value"]}>
  //                   <td>{org.name}</td>
  //                   <td>{org.amzn_role_arn}</td>
  //                   <td>
  //                     {this.getMomentLocalTime(org.joined_dt)}
  //                   </td>
  //                   <td>
  //                     <Link to={this.buildUrlSecGroups(org.id["@value"])}>
  //                       Security Groups
  //                     </Link>
  //                   </td>
  //                   <td>
  //                     <Link to={this.buildUrlSettings(org.id["@value"])}>
  //                       Settings
  //                     </Link>
  //                   </td>
  //                 </tr>
  //             )
  //           }
  //         </tbody>
  //       </table>
  //     </div>
  //   );
  // }

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
