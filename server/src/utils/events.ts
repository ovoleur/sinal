import { Server, Socket } from "socket.io";
import { io } from "socket.io-client";
import { map } from "zod";
import { dicoHasWord } from "../Endpoint/dictionary";
import { get_guess, LetterResult } from "../Endpoint/guess";
import { get_id, get_word } from "../Endpoint/start_game";
import {
  channelIdToHistory,
  disconnectMap,
  game1vs1Map,
  gameBrMap,
  idToWord,
  lobbyMap,
  playerMap,
  timeoutMap,
} from "./maps";
import {
  AnnounceChatMessage,
  ArgCreateLobbyType,
  ArgGuessWordType,
  ArgJoinLobbyType,
  ArgLeaveLobbyType,
  ArgStartGame1vs1Type,
  ArgStartGameBrType,
  ArgUpdateLobbyType,
  ArgUpdateWord,
  ChatMessageToSend,
  EventResponseFn,
  Game1vs1,
  GameBr,
  Lobby,
  LobbyType,
  PacketType,
  Player,
  Player1vs1Type,
  PlayerBr,
  ReceivedChatMessageType,
} from "./type";
import { PUBLIC_CHAT, PUBLIC_LOBBIES } from "./utils";

export const createLobbyEvent = (
  io: Server,
  socket: Socket,
  {
    isPublic,
    mode,
    name,
    owner,
    place: totalPlace,
    nbRounds,
    nbLife,
    globalTime,
    timeAfterFirstGuess,
    eliminationRate,
  }: ArgCreateLobbyType,
  response: (payload: PacketType) => void
) => {
  let lobbyId = get_id();
  let lobby: LobbyType = {
    id: lobbyId,
    state: "pre-game",
    name,
    totalPlace,
    playerList: new Array<Player>(),
    nbLifePerPlayer: nbLife,
    nbRounds,
    owner: owner.id,
    isPublic,
    mode,
    currentGameId: undefined,
    lastGame: undefined,
    globalTime,
    timeAfterFirstGuess,
    eliminationRate,
  };

  let player = playerMap.get(owner.id);
  if (player === undefined) {
    response({
      success: false,
      message: "Create_lobby n'a pas été effectué car le joueur n'existe pas",
      data: null,
    });
    return;
  }

  lobby.playerList.push(player);

  lobbyMap.set(lobbyId, lobby);
  console.log("Lobby created notif");

  // The user will join the lobby chat room
  // For now no message history is kept on the server
  socket.emit("add_player_to_chat_channel", {
    name: "Lobby",
    id: lobbyId,
    messageHistory: [],
  });

  socket.join(lobbyId);
  player.lobbyId = lobbyId;

  if (lobby.isPublic) {
    io.to(PUBLIC_LOBBIES).emit("lobbies_update_create", lobbyMap.get(lobbyId));
  }

  let packet: PacketType = {
    success: true,
    message: "Create_lobby a été effectué sans errreur",
    data: lobbyId,
  };

  // If the user created a lobby, he will leave it when deconnecting
  willLeaveLobbyOnDisconnect(io, socket, { lobbyId, playerId: player!.id });
  response(packet);
};

export const updateLobbyEvent = (
  io: Server,
  {
    isPublic,
    mode,
    name,
    place: totalPlace,
    nbRounds,
    nbLife,
    globalTime,
    timeAfterFirstGuess,
  }: ArgUpdateLobbyType,
  lobbyId: string
) => {
  let lobby = lobbyMap.get(lobbyId);
  let oldTotalPlace = lobby?.totalPlace;
  let oldPlayerList = lobby?.playerList;
  if (lobby !== undefined) {
    lobby = {
      ...lobby,
      isPublic,
      mode,
      name,
      nbLifePerPlayer: nbLife,
      totalPlace,
      nbRounds,
      globalTime,
      timeAfterFirstGuess,
      playerList: lobby.playerList.slice(0, totalPlace),
    };
    if (
      oldTotalPlace !== undefined &&
      oldPlayerList !== undefined &&
      oldTotalPlace > totalPlace
    ) {
      io.to(lobbyId).emit(
        "leave_other_players",
        oldPlayerList.slice(totalPlace).map((player) => player.id)
      );
    }
    lobbyMap.set(lobbyId, lobby);
    io.to(lobbyId).emit("updating_lobby", lobby);

    if (isPublic) {
      io.to(PUBLIC_LOBBIES).emit("updating_lobby_broadcast", lobby);
    }
  }
};

export const joinLobbyEvent = (
  io: Server,
  socket: Socket,
  { playerId, lobbyId }: ArgJoinLobbyType,
  response: EventResponseFn
) => {
  let lobby = lobbyMap.get(lobbyId);
  let player = playerMap.get(playerId);
  if (player === undefined) {
    response({
      success: false,
      message: "Le joueur n'existe pas !",
    });
    return;
  }
  if (lobby === undefined) {
    response({
      success: false,
      message: "Le lobby n'existe pas !",
    });
    return;
  }

  if (lobby.playerList.length >= lobby.totalPlace) {
    response({
      success: false,
      message: "Le lobby est déja plein !",
      data: null,
    });
    return;
  }
  socket.join(lobbyId);

  player.lobbyId = lobbyId;

  lobby.playerList.push(player);

  let messageHistory = channelIdToHistory.get(lobbyId) ?? [];
  // The user will join the lobby chat room
  // For now no message history is kept on the server
  socket.emit("add_player_to_chat_channel", {
    name: "Lobby",
    id: lobbyId,
    messageHistory,
  });

  io.to(PUBLIC_LOBBIES).to(lobbyId).emit("lobbies_update_join", { lobby });

  // If the user joined a lobby, he will leave it when deconnecting
  willLeaveLobbyOnDisconnect(io, socket, { lobbyId, playerId: player!.id });

  response({
    success: true,
    message: "Le lobby a été rejoins !",
  });
};

export const leaveLobbyEvent = (
  io: Server,
  socket: Socket,
  { playerId, lobbyId }: ArgLeaveLobbyType,
  response: EventResponseFn
) => {
  let lobby = lobbyMap.get(lobbyId); // Lobby where the user is
  if (lobby === undefined) {
    response({
      success: false,
      message: "leave_lobby : le lobby n'existe pas ! ",
      data: null,
    });
    return;
  }

  // Remove player from the playerList
  lobby.playerList = lobby.playerList.filter(
    (player) => player.id !== playerId
  );

  // If the player was the owner, change it
  if (lobby.owner === playerId) {
    if (lobby.playerList.length > 0) {
      lobby.owner = lobby.playerList[0].id;
    } else {
      lobby = undefined;
      lobbyMap.delete(lobbyId);
    }
  }

  // Change the lobbyId of the player
  let player = playerMap.get(playerId);
  if (player === undefined) {
    response({
      success: false,
      message: "leave_lobby : player doesn't exist ! ",
      data: null,
    });
    return;
  }

  willNoLongerLeaveLobbyOnDisconnect(io, socket, { lobbyId, playerId });

  io.to(PUBLIC_LOBBIES)
    .to(lobbyId)
    .emit("lobbies_update_leave", {
      lobby: lobby === undefined ? null : lobby,
      lobbyId,
    });

  player.lobbyId = null;
  // Leave the room
  socket.leave(lobbyId);

  // Leave the lobby chat room
  socket.emit("remove_player_of_chat_channel", lobbyId);

  console.log("Joueur retiré : ", playerId, " dans le lobby : ", lobbyId, "");
  response({
    success: true,
    message: "leave_lobby : le joueur a été retiré ! ",
    data: null,
  });
};

export const createPlayerEvent = (
  io: Server,
  playerName: string,
  response: EventResponseFn
) => {
  let playerId = get_id();
  let player = { id: playerId, name: playerName, lobbyId: null };
  playerMap.set(playerId, player);
  console.log(`player created : ${playerName} : ${playerId}`);
  response({
    success: true,
    message: "Le joueur a bien été créé",
    data: player,
  });
};

export const willLeaveLobbyOnDisconnect = (
  io: Server,
  socket: Socket,
  { playerId, lobbyId }: ArgLeaveLobbyType
) => {
  let disconnect = () => {
    leaveLobbyEvent(io, socket, { lobbyId, playerId }, () => {});
  };
  disconnectMap.set(playerId + lobbyId, disconnect);
  socket.on("disconnect", disconnect);
};

export const willNoLongerLeaveLobbyOnDisconnect = (
  io: Server,
  socket: Socket,
  { playerId, lobbyId }: ArgLeaveLobbyType
) => {
  let disconnect = disconnectMap.get(playerId + lobbyId);
  if (disconnect !== undefined) {
    socket.removeListener("disconnect", disconnect);
    disconnectMap.delete(playerId + lobbyId);
  }
};

//=====================================================================================
//                                events 1vs1
//=====================================================================================

/**
 * Starting a game of 1vs1
 * in this game, its the player finding the word with the least tries who win
 * except if the second player takes too long to find the word (@param timeAfterFirstGuess)
 * they have also a total time to find the word, else its a draw (@param globalTime)
 */
export const startGame1vs1Event = async (
  io: Server,
  { lobbyId, playerId, globalTime, timeAfterFirstGuess }: ArgStartGame1vs1Type
) => {
  console.log("startGame1vs1Event");
  let lobby = lobbyMap.get(lobbyId);
  if (lobby === undefined) {
    console.log("start_game_1vs1 : lobby doesn't exist");
    return;
  }
  if (lobby.owner !== playerId) {
    console.log("start_game_1vs1 : only the owner can start the game");
    return;
  }
  if (lobby.mode != "1vs1") {
    console.log("start_game_1vs1 : the mode selected on the lobby isn't 1vs1");
    return;
  }

  let playerList = lobbyMap.get(lobbyId)?.playerList;
  if (playerList === undefined) {
    console.log("start_game_1vs1 : playerList of the lobby is undefined");
    return;
  }
  if (playerList.length < 2) {
    console.log("start_game_1vs1 : playerList is too short, lobby : ", lobby);
    return;
  }

  let playerOne = playerList[0];
  let playerTwo = playerList[1];
  if (playerOne === undefined || playerTwo === undefined) {
    console.log("start_game_1vs1 : there isn't two players in the lobby");
    return;
  }

  let gameId = get_id();
  lobby.state = "in-game";
  lobby.currentGameId = gameId;

  let word = get_word();
  console.log("Mot à découvrir : ", word);
  idToWord.set(gameId, word); //the ID of the word is the same as the game
  let game: Game1vs1 = {
    playerOne: {
      id: playerOne.id,
      name: playerOne.name,
      nbLife: lobby.nbLifePerPlayer,
      hasWon: false,
      nbWins: 0,
    },
    playerTwo: {
      id: playerTwo.id,
      name: playerTwo.name,
      nbLife: lobby.nbLifePerPlayer,
      hasWon: false,
      nbWins: 0,
    },
    id: gameId,
    firstLetter: word.charAt(0),
    length: word.length,
    globalTime: globalTime,
    timeAfterFirstGuess: timeAfterFirstGuess,
    roundNumber: 1,
    nbRoundsTotal: lobby.nbRounds,
  };

  lobby.lastGame = {
    gameMode: "1vs1",
    playerList: playerList,
    winner: undefined,
    wordsToGuess: [word],
    triesHistory: lobby.playerList.map(() => []),
  };

  let timeout = setTimeout(() => {
    tempsEcoule1vs1(io, game, lobby);
  }, globalTime);
  timeoutMap.set(gameId, timeout);

  game1vs1Map.set(gameId, game);
  game.endTime = Date.now() + globalTime;
  io.to(lobbyId).emit("starting_game_1vs1", game);
  io.to(lobbyId).socketsJoin(gameId);

  //set the function of the disconnect for the first player
  let disconnectPlayerOne = () => {
    leaveGame1vs1(io, game, game.playerOne.id, lobby);
  };
  //set the function of the disconnect for the second player
  let disconnectPlayerTwo = () => {
    leaveGame1vs1(io, game, game.playerTwo.id, lobby);
  };
  let index = 0;
  //set the map of the disconnect
  disconnectMap.set(game.playerOne.id + game.id, disconnectPlayerOne);
  disconnectMap.set(game.playerTwo.id + game.id, disconnectPlayerTwo);
  let sockets = await io.to(lobbyId).allSockets();
  sockets.forEach((socketString) => {
    let socket = io.sockets.sockets.get(socketString);
    if (index === 0) {
      socket?.on("disconnect", disconnectPlayerOne);
    } else {
      socket?.on("disconnect", disconnectPlayerTwo);
    }
    index++;
  });
};

/**
 * Is called each time a player enter or delete a letter,
 * send to the two players an array of boolean, true for a letter and false for spaces
 */
export const updateWordEvent = (
  io: Server,
  { word, gameId, playerId }: ArgUpdateWord
) => {
  let array = new Array<boolean>();
  let regex = /[A-Z]/i;
  for (let i = 0; i < word.length; i++) {
    array.push(regex.test(word.charAt(i).toUpperCase()));
  }

  io.to(gameId).emit("update_word_broadcast", { array, playerId });
};

/**
 * Is called when the player send a word
 * return to the player an array of the result of this word (right place / wrong place / not in the word) for each letter
 * using the @param response to return this array
 *
 * If word was correct, manage to see which player won or set a timer if necessary
 */
export const guessWord1vs1Event = (
  io: Server,
  response: any,
  { word, gameId, playerId, lobbyId }: ArgGuessWordType
) => {
  let game = game1vs1Map.get(gameId);
  if (game === undefined) {
    console.log("guess_word_1vs1 : there is no game unsing this gameId");
    return;
  }

  let player;
  let otherPlayer;
  if (game.playerOne.id === playerId) {
    player = game.playerOne;
    otherPlayer = game.playerTwo;
  } else if (game.playerTwo.id === playerId) {
    player = game.playerTwo;
    otherPlayer = game.playerOne;
  } else {
    console.log(
      "guess_word_1vs1 : there is no player in the game with this playerId"
    );
    return;
  }

  if (!dicoHasWord(word)) {
    console.log("guess_word_1vs1 : this word isn't in the dictionary");
    return;
  }

  if (player.nbLife === 0) {
    console.log("guess_word_1vs1 : player has no life left 💀");
    return;
  }

  let tab_res = get_guess(gameId, word, idToWord);
  response({
    success: true,
    message: "Le resultat du mot est renvoyé",
    data: tab_res,
  });
  player.nbLife--;
  io.to(gameId).emit("guess_word_broadcast", { tab_res, playerId, game });

  let win = true;
  tab_res.forEach((letter) => {
    if (letter !== LetterResult.RIGHT_POSITION) win = false;
  });

  let lobby = lobbyMap.get(lobbyId);
  if (lobby !== undefined) {
    if (lobby.lastGame !== undefined) {
      for (let i = 0; i < lobby.playerList.length; i++) {
        if (lobby.playerList[i].id === playerId) {
          lobby.lastGame?.triesHistory[i].push(tab_res);
        }
      }
    }
    if (lobby.lastGame?.triesHistory === undefined) {
      return;
    }

    if (win) {
      player.hasWon = true;

      // If the opposing player has already won, the round will be decided on the number of life used to guess the word
      if (otherPlayer.hasWon) {
        if (player.nbLife > otherPlayer.nbLife) {
          // Player wins the round.
          io.to(gameId).emit("winning_round_1vs1", player.id);
          player.nbWins++;

          // If we have reached the final round, then, it's the end of the game
          if (game.roundNumber >= game.nbRoundsTotal) {
            // We get the winner of the game (or the tie if it's a tie)
            let winner = get1vs1GameWinner(player, otherPlayer, lobbyId);

            io.to(gameId).emit("winning_game_1vs1", winner);

            // The game is finished, we change the lastGame informations
            lobby.lastGame = {
              ...lobby.lastGame,
              winner,
            };
            ending1vs1Game(io, lobby, gameId);
          } else {
            sendAnnounceChatMessageWord(io, "round", lobby.id, game.id);
            // Launch another round
            game.roundNumber++;
            newWord1vs1(game, lobby);

            // Waiting 3 seconds until the next round
            setTimeout(() => {
              setGlobalTimeout(io, game, lobby);
              io.to(gameId).emit("next_round", game);
            }, 3000);
          }
        } else {
          // Other player wins the round
          io.to(gameId).emit("winning_round_1vs1", otherPlayer.id);
          otherPlayer.nbWins++;

          // If we have reached the final round, then, it's the end of the game
          if (game.roundNumber >= game.nbRoundsTotal) {
            let winner = get1vs1GameWinner(player, otherPlayer, lobbyId);

            io.to(gameId).emit("winning_game_1vs1", winner);

            // The game is finished, we change the lastGame informations
            lobby.lastGame = {
              ...lobby.lastGame,
              winner,
            };
            ending1vs1Game(io, lobby, gameId);
          } else {
            // Launch another round
            game.roundNumber++;
            newWord1vs1(game, lobby);

            sendAnnounceChatMessageWord(io, "round", lobby.id, game.id);
            // Waiting 3 seconds until the next round
            setTimeout(() => {
              setGlobalTimeout(io, game, lobby);
              io.to(gameId).emit("next_round", game);
            }, 3000);
          }
        }
      } else if (player.nbLife >= otherPlayer.nbLife - 1) {
        // The player who has win has more lives left than his opponent. Even if his opponent guess the word, he will lose.
        io.to(gameId).emit("winning_round_1vs1", player.id);
        player.nbWins++;

        if (game.roundNumber >= game.nbRoundsTotal) {
          // We get the winner of the game (or the tie if it's a tie)
          let winner = get1vs1GameWinner(player, otherPlayer, lobbyId);

          io.to(gameId).emit("winning_game_1vs1", winner);

          // The game is finished, we change the lastGame informations
          lobby.lastGame = {
            ...lobby.lastGame,
            winner,
          };
          ending1vs1Game(io, lobby, gameId);
        } else {
          sendAnnounceChatMessageWord(io, "round", lobby.id, game.id);
          // Launch another round
          game.roundNumber++;
          newWord1vs1(game, lobby);

          // Waiting 3 seconds until the next round
          setTimeout(() => {
            setGlobalTimeout(io, game, lobby);
            io.to(gameId).emit("next_round", game);
          }, 3000);
        }
      } else {
        // If the player has guess but the opponent can guess in less tries, the opponent has (by default) 60 seconds to find the word.
        let timeout = timeoutMap.get(gameId);

        // Clear global timeout of the game
        if (timeout !== undefined) {
          clearTimeout(timeout);
        }

        // Execute the function after timeAfterFirstGuess (60 seconds by default)
        timeout = setTimeout(() => {
          tempsEcoule1vs1(io, game, lobby);
        }, game.timeAfterFirstGuess);

        timeoutMap.set(gameId, timeout);

        // Set endTime to (now + timeAfterFirstGuess) if the global timer does not end sooner.
        if (
          game.endTime !== undefined &&
          game.endTime > Date.now() + game.timeAfterFirstGuess
        ) {
          game.endTime = game.timeAfterFirstGuess + Date.now();
        }

        io.to(gameId).emit("first_winning_player_1vs1", game);
      }
    } else if (game.playerOne.nbLife === 0 && game.playerTwo.nbLife === 0) {
      // If neither the player or his oppenent has no more lives, it's a tie for the round.
      io.to(gameId).emit("draw_round_1vs1");

      if (lobby && lobby.lastGame) {
        if (game.roundNumber >= game.nbRoundsTotal) {
          // We get the winner of the game (or the tie if it's a tie)
          let winner = get1vs1GameWinner(player, otherPlayer, lobbyId);

          io.to(gameId).emit("winning_game_1vs1", winner);

          // The game is finished, we change the lastGame informations
          lobby.lastGame = {
            ...lobby.lastGame,
            gameMode: "1vs1",
            playerList: lobby.playerList,
            winner,
            triesHistory: lobby.lastGame?.triesHistory || [[]],
          };
          ending1vs1Game(io, lobby, gameId);
        } else {
          sendAnnounceChatMessageWord(io, "round", lobby.id, game.id);
          // Launch another round
          game.roundNumber++;
          newWord1vs1(game, lobby);

          // Waiting 3 seconds until the next round
          setTimeout(() => {
            setGlobalTimeout(io, game, lobby);
            io.to(gameId).emit("next_round", game);
          }, 3000);
        }
      }
    } else if (player.nbLife <= otherPlayer.nbLife && otherPlayer.hasWon) {
      io.to(gameId).emit("winning_round_1vs1", otherPlayer.id);
      otherPlayer.nbWins++;
      if (game.roundNumber >= game.nbRoundsTotal) {
        let winner = get1vs1GameWinner(player, otherPlayer, lobbyId);

        io.to(gameId).emit("winning_game_1vs1", winner);

        lobby.lastGame = {
          ...lobby.lastGame,
          winner,
        };
        ending1vs1Game(io, lobby, gameId);
      } else {
        sendAnnounceChatMessageWord(io, "round", lobby.id, game.id);
        // Launch another round
        game.roundNumber++;
        newWord1vs1(game, lobby);

        // Waiting 3 seconds until the next round
        setTimeout(() => {
          setGlobalTimeout(io, game, lobby);
          io.to(gameId).emit("next_round", game);
        }, 3000);
      }
    }
  }
};

/**
 * Is called when the timer hit 0
 * It will end the game by choosing which player won or if its a draw
 */
const tempsEcoule1vs1 = (
  io: Server,
  game: Game1vs1 | undefined,
  lobby?: LobbyType | undefined
) => {
  if (
    game !== undefined &&
    lobby !== undefined &&
    lobby.lastGame !== undefined
  ) {
    //initialise lastGame of the lobby (currently the game being played)
    lobby.lastGame = {
      ...lobby.lastGame,
      gameMode: "1vs1",
      playerList: lobby.playerList,
      winner: undefined,
      triesHistory: lobby.lastGame?.triesHistory || [[]],
    };
    lobby.state = "pre-game";

    // FIXME: For the moment context is "finished" whatever happens, but move and change to "round" where necessary

    if (game.playerOne.hasWon && !game.playerTwo.hasWon) {
      // Player One has Won
      lobby.lastGame.winner = playerMap.get(game.playerOne.id);
      game.playerOne.nbWins++;

      io.to(game.id).emit("winning_round_1vs1", game.playerOne.id);
    } else if (!game.playerOne.hasWon && game.playerTwo.hasWon) {
      // Player Two has Won
      lobby.lastGame.winner = playerMap.get(game.playerTwo.id);
      game.playerTwo.nbWins++;

      io.to(game.id).emit("winning_round_1vs1", game.playerTwo.id);
    } else {
      // nobody won, normally if both players had won then the timer is clear so tempsEcoule1vs1 is never called
      io.to(game.id).emit("draw_round_1vs1");
    }
    if (game.roundNumber < game.nbRoundsTotal) {
      game.roundNumber++;
      newWord1vs1(game, lobby);

      sendAnnounceChatMessageWord(io, "round", lobby.id, game.id);

      // Waiting 3 seconds until the next round
      setTimeout(() => {
        setGlobalTimeout(io, game, lobby);
        io.to(game.id).emit("next_round", game);
      }, 3000);
    } else {
      let winner = get1vs1GameWinner(game.playerOne, game.playerTwo, lobby.id);

      io.to(game.id).emit("winning_game_1vs1", winner);

      lobby.lastGame = {
        ...lobby.lastGame,
        winner,
      };
      ending1vs1Game(io, lobby, game.id);
    }
  }
};

/**
 * Private function which ends the game.
 * @param io - Server
 * @param lobby - Lobby of the game
 * @param gameId - ID of the game
 */
const ending1vs1Game = (io: Server, lobby: LobbyType, gameId: string) => {
  // We redirecting to the PreGameLobby
  sendAnnounceChatMessageWord(io, "finished", lobby.id, gameId);
  lobby.state = "pre-game";

  // Clear the timeout
  let timeout = timeoutMap.get(gameId);
  if (timeout !== undefined) {
    clearTimeout(timeout);
  }
  io.to(gameId).emit("ending_game", { lobby });
  io.to(gameId).socketsLeave(gameId);
  game1vs1Map.delete(gameId);
};

/**
 * Private function that returns the winner of the match when all the rounds was played.
 * @param io - Server
 * @param player - Player
 * @param otherPlayer - Oppenent Player
 * @param gameId - ID of the Game
 * @param lobbyId - ID of the Lobby
 * @returns The winner of the match
 */
const get1vs1GameWinner = (
  player: Player1vs1Type,
  otherPlayer: Player1vs1Type,
  lobbyId: string
) => {
  let winner: Player | undefined;
  if (player.nbWins > otherPlayer.nbWins) {
    // If the player has won more rounds, he wins the game
    winner = {
      id: player.id,
      lobbyId,
      name: player.name,
    };
  } else if (player.nbWins < otherPlayer.nbWins) {
    winner = {
      id: otherPlayer.id,
      lobbyId,
      name: otherPlayer.name,
    };
  } else {
    // If they have won the same number of games, there is a tie.
    winner = undefined;
  }

  return winner;
};

/**
 * Function which is called when we have another round.
 * This function choose a new word to guess, and initialize all the properties of the new round.
 * @param game - 1vs1 GameState
 * @param lobby - Lobby of the Game
 * @return The new word to guess
 */
const newWord1vs1 = (game: Game1vs1, lobby: LobbyType) => {
  if (game !== undefined) {
    // Clear the timeout of the game.
    let timeout = timeoutMap.get(game.id);
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }

    // Reset the endTime of the game.
    game.endTime = undefined;

    // Choose a new word.
    let newWord = get_word();
    console.log("Mot à découvrir : ", newWord);
    idToWord.set(game.id, newWord);

    // Update the wordsToGuess array of the Game.
    lobby.lastGame?.wordsToGuess.push(newWord);

    // Initialize all the properties of the new round.
    game.firstLetter = newWord.charAt(0);
    game.length = newWord.length;
    game.playerOne.nbLife = lobby.nbLifePerPlayer;
    game.playerOne.hasWon = false;
    game.playerTwo.nbLife = lobby.nbLifePerPlayer;
    game.playerTwo.hasWon = false;
  }
};

const setGlobalTimeout = (
  io: Server,
  game: Game1vs1 | undefined,
  lobby: LobbyType | undefined
) => {
  if (game !== undefined) {
    let timeout = setTimeout(() => {
      tempsEcoule1vs1(io, game, lobby);
    }, game.globalTime);

    timeoutMap.set(game.id, timeout);
    game.endTime = Date.now() + game.globalTime;
  }
};

//=====================================================================================
//                                events battle-royale
//=====================================================================================

/**
 * Starting a game of battle royale
 *
 * in this game, the @param eliminationRate % last players to find the word won't pass to the next round,
 * until there id only one player left (the winner).
 *
 * Players have a total time (@param globalTime) to find the word, else another word is choose (can only happen thrice in a raw, else the game stop)
 * After the first player find the word, other players have a limited time to find it (@param timeAfterFirstGuess)
 * Only players who found the word can pass through the round and play the next one
 */
export const startGameBrEvent = async (
  io: Server,
  {
    lobbyId,
    playerId,
    eliminationRate,
    globalTime,
    timeAfterFirstGuess,
  }: ArgStartGameBrType
) => {
  console.log("startGameBrEvent");
  let lobby = lobbyMap.get(lobbyId);
  if (lobby === undefined) {
    console.log("start_game_br : lobby doesn't exist");
    return;
  }
  if (lobby.owner !== playerId) {
    console.log("start_game_br : only the owner can start the game");
    return;
  }
  if (lobby.mode !== "battle-royale") {
    console.log(
      "start_game_br : the mode selected on the lobby isn't battle-royale"
    );
    return;
  }

  let lobbyPlayerList = lobby.playerList;
  if (lobbyPlayerList === undefined) {
    console.log("start_game_br : playerList of the lobby is undefined");
    return;
  }
  if (lobbyPlayerList.length < 2) {
    console.log("start_game_br : playerList is too short, lobby : ", lobby);
    return;
  }

  let gameId = get_id();
  lobby.state = "in-game";
  lobby.currentGameId = gameId;

  let playerArray = new Array<PlayerBr>();
  lobbyPlayerList.forEach((player) => {
    if (player !== undefined && lobby !== undefined) {
      playerArray.push({
        id: player.id,
        name: player.name,
        nbLife: lobby?.nbLifePerPlayer,
      });
    }
  });

  let game: GameBr = {
    playerList: playerArray,
    playerFound: new Array(),
    playersLastNextRound: Math.floor(
      playerArray.length * (1 - eliminationRate / 100)
    ),
    id: gameId,
    firstLetter: "a",
    length: 0,
    eliminationRate: eliminationRate,
    globalTime: globalTime,
    timeAfterFirstGuess: timeAfterFirstGuess,
    numberOfDrawStreak: 0,
    nbLifePerPlayer: lobby.nbLifePerPlayer,
  };

  newWordBr(io, game, globalTime, lobbyId);

  gameBrMap.set(gameId, game);
  io.to(lobbyId).emit("starting_game_br", game);
  io.to(lobbyId).socketsJoin(gameId);

  //get all the socket for the game
  let sockets = await io.to(gameId).allSockets();
  let socketsIterator = sockets.values();
  //the order of the playerList is the same of the set of the socket so we can use the foreach of the player to get the playerId
  game.playerList.forEach((player) => {
    let disconnect = () => {
      leaveGameBr(io, game, player.id, lobbyId);
    };
    //set the map for the disconnect
    disconnectMap.set(player.id + game.id, disconnect);
    let socket = io.sockets.sockets.get(socketsIterator.next().value);
    socket?.on("disconnect", disconnect);
  });
};

/**
 * Is called when a player send a word
 * return to the player an array of the result of this word (right place / wrong place / not in the word) for each letter
 * using the @param response to return this array
 *
 * If word was correct, manage to see if he's the first player to find it, and start a timer if so
 */
export const guessWordBrEvent = (
  io: Server,
  response: any,
  { word, gameId, playerId, lobbyId }: ArgGuessWordType
) => {
  let timeout;
  let game = gameBrMap.get(gameId);
  let lobby = lobbyMap.get(lobbyId);
  if (game === undefined) {
    console.log("guess_word_br : there is no game unsing this gameId");
    return;
  }

  if (lobby === undefined) {
    console.log("guess_word_br : there is no lobby unsing this lobbyId");
    return;
  }

  if (!dicoHasWord(word)) {
    console.log("guess_word_br : this word isn't in the dictionary : ", word);
    return;
  }

  let player = game.playerList.find((p) => p.id === playerId);
  if (player === undefined) {
    console.log(
      "guess_word_br : there is no player in the game with this playerId"
    );
    return;
  }

  if (player.nbLife === 0) {
    console.log("guess_word_br : player has no life left 💀");
    return;
  }

  let tab_res = get_guess(gameId, word, idToWord);
  response({
    success: true,
    message: "Le resultat du mot est renvoyé",
    data: tab_res,
  });
  player.nbLife--;
  io.to(gameId).emit("guess_word_broadcast", { tab_res, playerId, game, word });

  let win = true;
  tab_res.forEach((letter) => {
    if (letter !== LetterResult.RIGHT_POSITION) win = false;
  });

  if (win) {
    if (game.playerFound.length === 0) {
      game.playerFound.push(player);
      game.numberOfDrawStreak = 0;

      setNewTimeout(io, game, game.timeAfterFirstGuess, lobbyId);

      io.to(gameId).emit("first_winning_player_br", game);
      if (game.playerFound.length === game.playersLastNextRound) {
        //the game is finished we delete the timeout
        sendAnnounceChatMessageWord(io, "finished", lobbyId, game.id);
        timeout = timeoutMap.get(game.id);
        if (timeout !== undefined) clearTimeout(timeout);
        io.to(gameId).emit("winning_player_br", playerId);
        lobby.state = "pre-game";
        io.to(gameId).emit("ending_game", { lobby });
        io.to(gameId).socketsLeave(gameId);
      }
    } else if (game.playerFound.length >= game.playersLastNextRound) {
      console.log("guess_word_br : player guessed too late");
      return;
    } else {
      game.playerFound.push(player);

      if (game.playerFound.length === game.playersLastNextRound) {
        game.playersLastNextRound = Math.floor(
          game.playerFound.length * (1 - game.eliminationRate / 100)
        );

        if (game.playersLastNextRound === 0) {
          //the game is finished we delete the timeout
          sendAnnounceChatMessageWord(io, "finished", lobbyId, game.id);
          timeout = timeoutMap.get(game.id);
          if (timeout !== undefined) clearTimeout(timeout);
          io.to(gameId).emit("winning_player_br", playerId);
          lobby.state = "pre-game";
          io.to(gameId).emit("ending_game", { lobby });
          io.to(gameId).socketsLeave(gameId);
        } else if (game.playersLastNextRound === 1) {
          sendAnnounceChatMessageWord(io, "round", lobbyId, game.id);

          game.playerList = game.playerFound;
          game.playerFound = new Array();
          newWordBr(io, game, game.globalTime, lobbyId);

          io.to(gameId).emit("next_word_br", game);
          //TODO finale (BO3 ?) il peut y avoir + de 2 joueurs en cas d'eliminationRate élevé /!\
        } else {
          sendAnnounceChatMessageWord(io, "round", lobbyId, game.id);
          game.playerList = game.playerFound;
          game.playerFound = new Array();
          newWordBr(io, game, game.globalTime, lobbyId);

          io.to(gameId).emit("next_word_br", game);
        }
      }
    }
  }

  let noOneAlive = true;
  game.playerList.forEach((p) => {
    if (p.nbLife !== 0) {
      noOneAlive = false;
    }
  });
  if (noOneAlive && game.playerFound.length === 0) {
    if (game.numberOfDrawStreak < 3) {
      sendAnnounceChatMessageWord(io, "round", lobbyId, game.id);
      game.numberOfDrawStreak++;
      io.to(gameId).emit("draw_br");

      game.playerFound = new Array();

      newWordBr(io, game, game.globalTime, lobbyId);

      io.to(gameId).emit("next_word_br", game);
    } else {
      //the game is finished we delete the timeout
      sendAnnounceChatMessageWord(io, "finished", lobbyId, game.id);
      timeout = timeoutMap.get(game.id);
      if (timeout !== undefined) clearTimeout(timeout);
      io.to(gameId).emit("end_of_game_draw", game);
    }
  }
};

/**
 * Is called when the timer hit 0
 * It will end the round and start another one,
 * or end the game by choosing which player won
 */
const tempsEcouleBr = (
  game: GameBr | undefined,
  io: Server,
  lobbyId: string
) => {
  if (game !== undefined) {
    let lobby = lobbyMap.get(lobbyId);
    let timeout = timeoutMap.get(game.id);
    if (timeout !== undefined) clearTimeout(timeout);
    let word = idToWord.get(game.id) ?? "";
    newWordBr(io, game, game.globalTime, lobbyId);
    if (lobby !== undefined) {
      if (game.playerFound.length === 0) {
        if (game.numberOfDrawStreak < 3) {
          game.numberOfDrawStreak++;
          game.playerList.forEach((p) => {
            p.nbLife = game.nbLifePerPlayer;
          });

          sendAnnounceChatMessageWordWithWord(io, "round", lobbyId, word);
          io.to(game.id).emit("draw_br");
          io.to(game.id).emit("next_word_br", game);
        } else {
          //the game is finished we delete the timeout
          sendAnnounceChatMessageWordWithWord(io, "finished", lobbyId, word);
          timeout = timeoutMap.get(game.id);
          if (timeout !== undefined) clearTimeout(timeout);
          io.to(game.id).emit("end_of_game_draw", game);
        }
      } else if (game.playerFound.length === 1) {
        sendAnnounceChatMessageWordWithWord(io, "finished", lobbyId, word);
        io.to(game.id).emit("winning_player_br", game.playerFound[0].id);
        //the game is finished we delete the timeout
        timeout = timeoutMap.get(game.id);
        if (timeout !== undefined) clearTimeout(timeout);
        lobby.state = "pre-game";
        io.to(game.id).emit("ending_game", { lobby });
        io.to(game.id).socketsLeave(game.id);
      } else {
        game.playersLastNextRound = Math.floor(
          game.playerFound.length * (1 - game.eliminationRate / 100)
        );
        game.playerList = game.playerFound;
        game.playerFound = new Array();

        game.playerList.forEach((p) => {
          p.nbLife = game.nbLifePerPlayer;
        });

        sendAnnounceChatMessageWordWithWord(io, "round", lobbyId, word);
        io.to(game.id).emit("next_word_br", game);
      }
    } else if (game.playerFound.length === 1) {
      sendAnnounceChatMessageWordWithWord(io, "finished", lobbyId, word);
      io.to(game.id).emit("winning_player_br", game.playerFound[0].id);
      //the game is finished we delete the timeout
      timeout = timeoutMap.get(game.id);
      if (timeout !== undefined) clearTimeout(timeout);
      io.to(game.id).socketsLeave(game.id);
    } else {
      game.playersLastNextRound = Math.floor(
        game.playerFound.length * (1 - game.eliminationRate / 100)
      );

      if (game.playerFound.length <= game.playersLastNextRound)
        game.playersLastNextRound = Math.floor(
          game.playerFound.length * (1 - game.eliminationRate / 100)
        );

      game.playerList = game.playerFound;
      game.playerFound = new Array();

      game.playerList.forEach((p) => {
        p.nbLife = game.nbLifePerPlayer;
      });

      sendAnnounceChatMessageWordWithWord(io, "round", lobbyId, word);
      io.to(game.id).emit("next_word_br", game);
    }
  }
};

/**
 * Function which is called when we have another round.
 * This function choose a new word to guess, and initialize all the properties of the new round.
 * @param io - Server
 * @param game - 1vs1 GameState
 * @param lobby - Lobby of the Game
 * @return The new word to guess
 */
const newWordBr = (
  io: Server,
  game: GameBr | undefined,
  newTime: number,
  lobbyId: string
) => {
  if (game !== undefined) {
    let time = timeoutMap.get(game.id);
    if (time !== undefined) {
      clearTimeout(time);
    }
    game.endTime = undefined;
    let newWord = get_word();
    console.log("Mot à découvrir : ", newWord);
    idToWord.set(game.id, newWord);
    game.firstLetter = newWord.charAt(0);
    game.length = newWord.length;

    game.playerList.forEach((p) => {
      p.nbLife = game.nbLifePerPlayer;
    });

    setNewTimeout(io, game, newTime, lobbyId);
  }
};

const setNewTimeout = (
  io: Server,
  game: GameBr | undefined,
  newTime: number,
  lobbyId: string
) => {
  if (game !== undefined) {
    if (game.endTime === undefined || game.endTime > Date.now() + newTime) {
      let timeout = timeoutMap.get(game.id);
      if (timeout !== undefined) clearTimeout(timeout);

      timeout = setTimeout(() => {
        tempsEcouleBr(game, io, lobbyId);
      }, newTime);

      game.endTime = Date.now() + newTime;
      timeoutMap.set(game.id, timeout);
    }
  }
};

//=====================================================================================

export const sendChatMessage = (
  io: Server,
  { content, playerId, channelId }: ReceivedChatMessageType
) => {
  const player = playerMap.get(playerId);

  if (!player) {
    console.log("send_chat_message : player doesn't seem to exist");
    return;
  }

  let messageId = get_id();

  let messageToSend: ChatMessageToSend = {
    channelId,
    author: player.name,
    content,
    id: messageId,
    isAnnoncement: false,
  };

  io.to(channelId).emit("broadcast_message", messageToSend);

  const messageHistory = channelIdToHistory.get(channelId);
  if (messageHistory) {
    messageHistory.push(messageToSend);
  } else {
    channelIdToHistory.set(channelId, [messageToSend]);
  }
};

/**
 * Send an annoncement when word changes so that players are aware of the last word to discover
 * @param io
 * @param context Context about the game, if it's finished or just changement of round
 * @param lobbyId
 * @param gameId
 */
export const sendAnnounceChatMessageWordWithWord = (
  io: Server,
  context: "finished" | "round",
  lobbyId: string,
  word: string
) => {
  let content = "Partie terminée";

  if (context === "round") {
    content = "Round terminé";
  }

  sendAnnounceChatMessage(io, {
    content: `${content} Le mot était : ${word} !`,
    channelId: lobbyId,
  });
};

/**
 * Send an annoncement when word changes so that players are aware of the last word to discover
 * @param io
 * @param context Context about the game, if it's finished or just changement of round
 * @param lobbyId
 * @param gameId
 */
export const sendAnnounceChatMessageWord = (
  io: Server,
  context: "finished" | "round",
  lobbyId: string,
  gameId: string
) => {
  let word = idToWord.get(gameId);

  if (word) {
    let content = "Partie terminée.";

    if (context === "round") {
      content = "Round terminé.";
    }

    sendAnnounceChatMessage(io, {
      content: `${content} Le mot était : ${word.toUpperCase()} !`,
      channelId: lobbyId,
    });
  }
};

export const sendAnnounceChatMessage = (
  io: Server,
  { content, channelId }: AnnounceChatMessage
) => {
  let messageId = get_id();

  let messageToSend: ChatMessageToSend = {
    isAnnoncement: true,
    channelId,
    author: "",
    content,
    id: messageId,
  };

  io.to(channelId).emit("broadcast_message", messageToSend);
  const messageHistory = channelIdToHistory.get(channelId);
  if (messageHistory) {
    messageHistory.push(messageToSend);
  } else {
    channelIdToHistory.set(channelId, [messageToSend]);
  }
};

/**
 * Is called when a player leaves a battle royal game whether it is voluntary or not.
 *
 * @param io - The io server
 * @param game - The game
 * @param playerId - The id of the player
 */
export const leaveGameBr = async (
  io: Server,
  game: GameBr,
  playerId: string,
  lobbyId: string
) => {
  //check if the player exist
  let indexPlayer = game.playerList.findIndex(
    (player) => playerId === player.id
  );
  let lobby = lobbyMap.get(lobbyId);
  if (game !== undefined && indexPlayer >= 0 && lobby != undefined) {
    //the current game have one less player
    game.playersLastNextRound -= 1;
    //Informs the other players that a player has left.
    io.to(game.id).emit("player_leave", {
      playerId: game.playerList[indexPlayer].id,
      playerName: game.playerList[indexPlayer].name,
    }); //emit the name of the player that leave
    let timeout;
    let index = game.playerList.findIndex((player) => playerId === player.id);
    //reset the disconnect listeners
    let disconnect = disconnectMap.get(playerId + game.id);
    if (disconnect !== undefined) {
      //get all the socket for the lobby
      let sockets = await io.to(game.id).allSockets();
      sockets.forEach((socketString) => {
        let socket = io.sockets.sockets.get(socketString);
        //remove only the disconnect that as the same function so for one user
        socket?.removeListener("disconnect", disconnect);
      });
    }
    disconnectMap.delete(playerId + game.id);
    if (index !== -1) {
      //delete the player in the playerList
      game.playerList.splice(index, 1);
    }
    index = game.playerFound.findIndex((player) => playerId === player.id);
    if (index !== -1) {
      //delete the player in the playerFound
      game.playerFound.splice(index, 1);
    }
    //check if the player that leave isn't in the player that win
    if (game.playerList.length > 0) {
      if (game.playersLastNextRound <= 0) {
        //1vs1 round
        io.to(game.id).emit("win_by_forfeit", game.playerList[0].id); //One player in playerList
        //the game is finished we delete the timeout
        timeout = timeoutMap.get(game.id);
        if (timeout !== undefined) clearTimeout(timeout);
        lobby.state = "pre-game";
        io.to(game.id).emit("ending_game", { lobby });
        io.to(game.id).socketsLeave(game.id);
      } else {
        //the game is finished without the player
        if (game.playersLastNextRound === 1) {
          //3 player 1 quit
          if (game.playerFound.length === 1) {
            io.to(game.id).emit("win_by_forfeit", game.playerFound[0].id);
            //the game is finished we delete the timeout
            timeout = timeoutMap.get(game.id);
            if (timeout !== undefined) clearTimeout(timeout);
            lobby.state = "pre-game";
            io.to(game.id).emit("ending_game", { lobby });
            io.to(game.id).socketsLeave(game.id);
          }
        } else {
          //case the game as many player and somebody leave the game
          if (game.playersLastNextRound === game.playerFound.length) {
            //if the new playersLastNextRound is the same as playerFound.length, the game is finish and the next word is send
            if (timeout !== undefined) clearTimeout(timeout);
            newWordBr(io, game, game.globalTime, lobbyId);
            game.playersLastNextRound = Math.floor(
              game.playerFound.length * (1 - game.eliminationRate / 100)
            );
            if (game.playerFound.length <= game.playersLastNextRound)
              game.playersLastNextRound = Math.floor(
                game.playerFound.length * (1 - game.eliminationRate / 100)
              );

            game.playerList = game.playerFound;
            game.playerFound = new Array();

            game.playerList.forEach((p) => {
              p.nbLife = game.nbLifePerPlayer;
            });

            io.to(game.id).emit("next_word_br", game);
          }
        }
      }
    }
    //save the change of the game
    gameBrMap.set(game.id, game);
  }
};

/**
 * Is called when a player leaves a 1vs1 game whether it is voluntary or not.
 *
 * @param io - The io server
 * @param game - The gameBr
 * @param playerId - The id of the player that leave
 * @param lobby - lobbyType can be undefined
 */
export const leaveGame1vs1 = async (
  io: Server,
  game: Game1vs1,
  playerId: string,
  lobby?: LobbyType
) => {
  if (game !== undefined && lobby !== undefined) {
    //the game is finished and nobody crash
    if (game.playerOne.id === playerId) {
      io.to(game.id).emit("player_leave", game.playerTwo.name); //emit the name of the player that leave
      io.to(game.id).emit("wining_player_1vs1", game.playerTwo.id);
      lobby.state = "pre-game";
      io.to(game.id).emit("ending_game", { lobby });
    } else if (game.playerTwo.id === playerId) {
      io.to(game.id).emit("player_leave", game.playerOne.name); //emit the name of the player that leave
      io.to(game.id).emit("wining_player_1vs1", game.playerOne.id);
      lobby.state = "pre-game";
      io.to(game.id).emit("ending_game", { lobby });
    }
    //reset the disconnect listeners
    let disconnect = disconnectMap.get(playerId + game.id);
    if (disconnect !== undefined) {
      //get all the socket for the lobby
      let sockets = await io.to(lobby.id).allSockets();
      sockets.forEach((socketString) => {
        let socket = io.sockets.sockets.get(socketString);
        socket?.removeListener("disconnect", disconnect);
      });
    }
    disconnectMap.delete(playerId + game.id);
    io.to(game.id).socketsLeave(game.id);
  }
};

/**
 * This method is called when the game is over or the player leave the game.
 * This method get the game and call leaveGame1vs1 or leaveGameBr.
 *
 * @param io - The io server
 * @param gameId - The id of the game
 * @param lobbyId - The id of the lobby
 * @param playerId - The id of the player
 */
export const leaveGame = (
  io: Server,
  gameId: string,
  lobbyId: string,
  playerId: string
) => {
  let game1vs1 = Game1vs1.safeParse(game1vs1Map.get(gameId));
  let lobby = lobbyMap.get(lobbyId);
  //if the game is a 1vs1
  if (game1vs1.success) {
    leaveGame1vs1(io, game1vs1.data, playerId, lobby);
  } else {
    //if the game is a Br
    let gameBr = GameBr.safeParse(gameBrMap.get(gameId));
    if (gameBr.success) {
      leaveGameBr(io, gameBr.data, playerId, lobbyId);
    }
  }
};
