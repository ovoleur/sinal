import { ToastId, UseToastOptions } from "@chakra-ui/react";
import axios from "axios";
import { NextRouter } from "next/router";
import { Dispatch, SetStateAction } from "react";
import { Socket } from "socket.io-client";
import { serverHttpUrl } from "./const";
import {
  BrGameInfo,
  BrGameState,
  ChatChannel,
  ChatMessage,
  ChattingActions,
  Game1vs1,
  LetterResult,
  Lobby,
  Packet,
  Player,
  TriesHistory,
  UpdateLobbyJoinPayload,
  UpdateLobbyLeavePayload,
} from "./types";

// Here are all the api calls
// Can be http request or websockets events
// All the logic is here and is used by components

export const guessWord = async (
  word: string,
  id: string
): Promise<LetterResult[]> => {
  try {
    const { data } = await axios.post<LetterResult[]>(
      `${serverHttpUrl}/guess`,
      {
        word,
        id,
      }
    );

    return data;
  } catch (e) {
    console.error(e);
  }
  // Error
  return [];
};

export const guessWordMulti = async (
  word: string,
  lobbyId: string,
  playerId: string,
  socket: Socket | null,
  response: (response: Packet) => void
) => {
  socket?.emit(
    "guess_word",
    {
      word,
      lobbyId,
      playerId,
    },
    response
  );
};

export const guessWordBr = (
  word: string,
  gameId: string | undefined,
  playerId: string,
  lobbyId: string,
  socket: Socket | null,
  response: (response: Packet) => void
) => {
  if (gameId !== undefined) {
    socket?.emit(
      "guess_word_br",
      {
        word,
        gameId,
        playerId,
        lobbyId,
      },
      response
    );
  }
};

export const addSocketConnectionEvent = (
  socket: Socket | null,
  setIsConnected: Dispatch<SetStateAction<boolean>>
) => {
  socket?.on("connect", () => {
    setIsConnected(true);
  });
  socket?.on("disconnect", () => {
    setIsConnected(false);
  });
};

export const addLobbiesEvent = (
  socket: Socket | null,
  setLobbies: Dispatch<SetStateAction<Lobby[]>>,
  player: Player,
  toast: (options?: UseToastOptions | undefined) => ToastId | undefined,
  router: NextRouter
) => {
  socket?.on("lobbies_update_create", (lobby: Lobby) => {
    console.log("Lobby created notif");
    setLobbies((lobbies) => [...lobbies, lobby]);
  });

  socket?.on("updating_lobby_broadcast", (lobby: Lobby) => {
    setLobbies((lobbies) =>
      lobbies.map((item) => {
        return item.id === lobby.id ? lobby : item;
      })
    );
  });

  socket?.on("leave_other_players", (listOfPlayers: string[]) => {
    if (listOfPlayers.includes(player.id)) {
      socket.emit(
        "leave_lobby",
        {
          roomId: player.lobbyId,
          playerId: player.id,
        },
        () => {}
      );
      toast({
        title: "Vous avez été kick de la game",
        status: "error",
        isClosable: true,
        duration: 2500,
      });
      router.push("/lobby");
    }
  });

  socket?.on(
    "lobbies_update_join",
    ({ lobby: lobbyChanged }: UpdateLobbyJoinPayload) => {
      if (!lobbyChanged) {
        return;
      }

      console.log("lobbies_update_join notif");
      setLobbies((lobbies) => {
        let newLobbies = lobbies.map((lobby) => {
          if (lobby.id === lobbyChanged.id) {
            return lobbyChanged;
          } else {
            return lobby;
          }
        });
        return newLobbies;
      });
    }
  );

  socket?.on(
    "lobbies_update_leave",
    ({ lobbyId, lobby: changedLobby }: UpdateLobbyLeavePayload) => {
      if (!lobbyId) {
        return;
      }

      setLobbies((lobbies) => {
        let newLobbies = lobbies.slice();
        if (!changedLobby) {
          newLobbies = newLobbies.filter((lobby) => lobby.id !== lobbyId);
        } else {
          newLobbies = lobbies.map((lobby) => {
            if (lobby.id === lobbyId) {
              return changedLobby;
            } else {
              return lobby;
            }
          });
        }
        return newLobbies;
      });
    }
  );

  socket?.emit("join_public_lobbies");
};

export const addPreGameEvent = (socket: Socket | null) => {
  socket?.on("starting_game", (gameId: number) => {
    console.log("starting game : ", gameId);
  });
};

export const removeLobbiesEvent = (socket: Socket | null) => {
  socket?.removeListener("lobbies_update_create");
  socket?.removeListener("lobbies_update_join");
  socket?.removeListener("lobbies_update_leave");
  socket?.removeListener("updating_lobby_broadcast");
  socket?.removeListener("kick_other_players");
  socket?.emit("leave_public_lobbies");
};

export const addSpecificLobbiesEvent = (
  socket: Socket,
  lobbyId: string,
  setLobby: Dispatch<SetStateAction<Lobby | null>>,
  setGameState: Dispatch<SetStateAction<Game1vs1 | BrGameInfo | null>>
) => {
  socket.on("starting_game_1vs1", (game: Game1vs1) => {
    console.log("starting-game-1vs1");
    setGameState(game);
    setLobby((lobby) => {
      if (lobby === null) {
        return null;
      } else {
        return { ...lobby, state: "in-game" };
      }
    });
  });

  socket.on("updating_lobby", (lobby: Lobby) => {
    setLobby(lobby);
  });

  socket.on("starting_game_br", (game: BrGameInfo) => {
    console.log("starting-game-br");
    setGameState(game);
    setLobby((lobby) => {
      if (lobby === null) {
        return null;
      } else {
        return { ...lobby, state: "in-game" };
      }
    });
  });
  socket.on(
    "lobbies_update_join",
    ({ lobby: changedLobby }: UpdateLobbyJoinPayload) => {
      if (!changedLobby) {
        console.log("lobbies_update_join notif, lobbyId: ", lobbyId);
        return;
      }
      if (changedLobby.id !== lobbyId) {
        return;
      }
      setLobby(changedLobby);
    }
  );

  socket.on(
    "lobbies_update_leave",
    ({
      lobby: changedLobby,
      lobbyId: changedLobbyId,
    }: UpdateLobbyLeavePayload) => {
      if (!changedLobby) {
        return;
      }
      console.log("leave lobby ping", { changedLobbyId, changedLobby });
      setLobby(changedLobby);
    }
  );

  socket.on("ending_game", (req) => {
    setTimeout(() => setLobby(req.lobby), 5000);
  });
};

export const removeSpecificLobbyEvent = (socket: Socket | null) => {
  socket?.removeListener("lobbies_update_join");
  socket?.removeListener("lobbies_update_leave");
  socket?.removeListener("ending_game");
  socket?.removeListener("starting_game_1vs1");
  socket?.removeListener("starting_game_br");
  socket?.removeListener("updating_lobby");
};

export const getSpecificLobby = (
  lobbyId: string,
  setLobby: Dispatch<SetStateAction<Lobby | null>>,
  socket: Socket,
  toast: (options?: UseToastOptions | undefined) => ToastId | undefined,
  player: Player
) => {
  axios
    .get<Lobby>(`${serverHttpUrl}/list_lobbies/${lobbyId}`)
    .then(({ data }) => {
      if (data !== null) {
        setLobby(data);

        if (player.id !== data.owner) {
          socket.emit(
            "join_lobby",
            {
              lobbyId: lobbyId,
              playerId: player?.id,
            },
            (response: Packet) => {
              toast({
                description: response.message,
                status: response.success ? "success" : "error",
                duration: 3000,
                isClosable: true,
              });
            }
          );
        }
      }
    });
};

export const addChatEvents = (
  socket: Socket,
  setChattingAction: React.Dispatch<React.SetStateAction<ChattingActions>>
) => {
  socket.on("broadcast_message", (message: ChatMessage) => {
    setChattingAction((action) => {
      return {
        ...action,
        channels: action.channels.map((channel) => {
          if (channel.id === message.channelId) {
            return {
              ...channel,
              messageHistory: [...channel.messageHistory, message],
            };
          } else {
            return {
              ...channel,
            };
          }
        }),
      };
    });
  });
  socket.on(
    "add_player_to_chat_channel",
    ({ name, id, messageHistory }: ChatChannel) => {
      setChattingAction((action) => {
        return {
          ...action,
          channels: [
            { name, messageHistory: messageHistory, id },
            ...action.channels,
          ],
        };
      });
    }
  );
  socket.on("remove_player_of_chat_channel", (channel_to_remove: string) => {
    setChattingAction((action) => {
      return {
        ...action,
        channels: action.channels.filter((channel) => {
          return channel.id !== channel_to_remove;
        }),
      };
    });
  });

  socket.emit("join_chat_global");
};

export const removeChatEvents = (socket: Socket) => {
  socket.removeListener("broadcast_message");
  socket.removeListener("add_player_to_chat_channel");
  socket.removeListener("remove_player_of_chat_channel");
  socket.emit("leave_chat_global");
};
export const addGuessWordBrBroadcast = async (
  socket: Socket,
  playerId: string,
  setGameState: React.Dispatch<React.SetStateAction<BrGameState[]>>,
  setNumberPlayerFound: React.Dispatch<React.SetStateAction<number>>
) => {
  socket?.on("guess_word_broadcast", (arg) => {
    if (
      arg.tab_res.every((element: number) => {
        if (element === 0) {
          return true;
        } else {
          return false;
        }
      })
    ) {
      setNumberPlayerFound((nb) => nb + 1);
    }
    if (arg.playerId !== playerId) {
      setGameState((gameState) => {
        return gameState.map((game) =>
          game.playerId === arg.playerId
            ? {
                ...game,
                triesHistory: [
                  ...game.triesHistory,
                  { result: arg.tab_res, wordTried: arg.word.toUpperCase() },
                ],
              }
            : { ...game }
        );
      });
    }
  });
};

export const addBrEvent = async (
  resetGame: (gameBr: BrGameInfo) => void,
  socket: Socket,
  playerId: string,
  toast: (options?: UseToastOptions | undefined) => ToastId | undefined,
  setEndpoint: React.Dispatch<React.SetStateAction<number>>,
  setGameState: React.Dispatch<React.SetStateAction<BrGameState[]>>,
  spectate: boolean,
  setNumberPlayerWinMax: React.Dispatch<React.SetStateAction<number>>
) => {
  socket?.on("first_winning_player_br", (arg) => {
    setEndpoint(arg.endTime);
  });
  socket?.on("win_by_forfeit", (arg) => {
    if (arg !== playerId && !spectate) {
      toast({
        title: "Perdu un joueur a quitté !",
        status: "error",
        isClosable: true,
        duration: 2500,
      });
      setGameState((gameSate) =>
        gameSate.map((game) =>
          game.playerId !== arg
            ? { ...game, isFinished: true, hasWon: false }
            : { ...game }
        )
      );
    } else if (!spectate) {
      //case use when one player crash or quit
      toast({
        title: "GG vous avez gagné par forfait",
        status: "success",
        isClosable: true,
        duration: 2500,
      });
      setGameState((gameSate) =>
        gameSate.map((game) =>
          game.playerId === arg
            ? { ...game, isFinished: true, hasWon: true }
            : { ...game }
        )
      );
    } else {
      toast({
        title: "Round terminé !",
        status: "info",
        isClosable: true,
        duration: 2500,
      });
    }
    return;
  });
  socket?.on("player_leave", (arg) => {
    setGameState((gameState) => {
      let index = gameState.findIndex((game) => game.playerId === arg.playerId);
      if (index !== -1) {
        gameState.splice(index, 1);
        setNumberPlayerWinMax((nb) => nb - 1);
      }
      return gameState;
    });

    toast({
      title: "le joueur " + arg.playerName + " a quitté la partie.",
      status: "info",
      isClosable: true,
      duration: 2500,
    });
  });
  socket?.on("winning_player_br", (arg) => {
    console.log("winning_player_br");
    if (arg !== playerId) {
      setGameState((gameSate) =>
        gameSate.map((game) =>
          game.playerId !== arg
            ? { ...game, isFinished: true, hasWon: false }
            : { ...game, isFinished: true, hasWon: true }
        )
      );
      if (spectate) {
        toast({
          title: "Round terminé !",
          status: "info",
          isClosable: true,
          duration: 2500,
        });
      } else {
        toast({
          title: "Perdu !",
          status: "error",
          isClosable: true,
          duration: 2500,
        });
      }
    }

    return;
  });
  socket?.on("next_word_br", (arg) => {
    resetGame(arg);
  });
  socket?.on("draw_br", () => {
    toast({
      title: "égalité un autre mot est choisie",
      status: "success",
      isClosable: true,
      duration: 2500,
    });
  });
  socket?.on("end_of_game_draw", (arg) => {
    toast({
      title: "Perdu egalité",
      status: "error",
      isClosable: true,
      duration: 2500,
    });
    setGameState((gameSate) =>
      gameSate.map((game) =>
        game.playerId !== arg
          ? { ...game, isFinished: true, hasWon: false }
          : { ...game }
      )
    );
  });
};

export const removeBrEvent = (socket: Socket | null) => {
  socket?.removeListener("guess_word_broadcast");
  socket?.removeListener("first_winning_player_br");
  socket?.removeListener("player_leave");
  socket?.removeListener("win_by_forfeit");
  socket?.removeListener("winning_player_br");
  socket?.removeListener("next_word_br");
  socket?.removeListener("draw_br");
  socket?.removeListener("end_of_game_draw");
};

export const lobbyOneVsOneAddEvents = (
  socket: Socket,
  toast: (options?: UseToastOptions | undefined) => ToastId | undefined,
  playerId: string,
  setHasWon: Dispatch<SetStateAction<boolean>>,
  tryHistoryP2: TriesHistory[],
  setTryHistoryP2: Dispatch<SetStateAction<TriesHistory[]>>,
  setWordP2: Dispatch<SetStateAction<string>>,
  setIsFinished: Dispatch<SetStateAction<boolean>>,
  setEndPoint: React.Dispatch<React.SetStateAction<number>>,
  setGameState: Dispatch<SetStateAction<Game1vs1 | BrGameInfo | null>>,
  setTryHistory: Dispatch<SetStateAction<TriesHistory[]>>,
  setWord: Dispatch<SetStateAction<string>>
) => {
  socket.on("first_winning_player_1vs1", (req) => {
    setEndPoint(req.endTime);
    if (
      (req.playerTwo.hasWon && req.playerTwo.id === playerId) ||
      (req.playerOne.hasWon && req.playerOne.id === playerId)
    ) {
      toast({
        title: "L'adversaire peut encore gagné !",
        status: "info",
        isClosable: true,
        duration: 2500,
      });
    }
  });

  socket.on("winning_game_1vs1", (winner: Player) => {
    setIsFinished(true);
    if (winner === null) {
      toast({
        title: "On n'a pas pu vous départager.",
        status: "info",
        isClosable: true,
        duration: 2500,
      });
    } else if (playerId === winner.id) {
      toast({
        title: "Vous avez gagné la partie",
        status: "success",
        isClosable: true,
        duration: 2500,
      });
      setHasWon(true);
    } else {
      toast({
        title: "Vous avez perdu la partie",
        status: "error",
        isClosable: true,
        duration: 2500,
      });
    }
  });

  socket.on("next_round", (game: Game1vs1) => {
    setIsFinished(false);
    setHasWon(false);
    setTryHistory([]);
    setTryHistoryP2([]);
    setWord(game.firstLetter.toUpperCase());
    setEndPoint(game.endTime);
    setGameState(game);
  });

  socket?.on("winning_round_1vs1", (req) => {
    setIsFinished(true);
    if (req === playerId) {
      toast({
        title: "Bravo ! vous avez gagné la manche",
        status: "success",
        isClosable: true,
        duration: 2500,
      });
      setHasWon(true);
    } else {
      toast({
        title: "Perdu !",
        status: "error",
        isClosable: true,
        duration: 2500,
      });
      setWordP2("●");
    }
  });
  socket.on("draw_round_1vs1", () => {
    console.log("draw_1vs1");
    setIsFinished(true);
    toast({
      title: "Egalité.",
      status: "info",
      isClosable: true,
      duration: 2500,
    });
  });

  socket.on("guess_word_broadcast", (req) => {
    if (req.playerId !== playerId) {
      setTryHistoryP2((tryHistoryP2) => [
        ...tryHistoryP2,
        { result: req.tab_res, wordTried: "●".repeat(req.tab_res.length) },
      ]);
    }
  });

  socket.on("update_word_broadcast", (req) => {
    if (req.playerId !== playerId) {
      setWordP2(
        req.array.map((tabElt: boolean) => (tabElt ? "●" : " ")).join("")
      );
    }
  });
  socket?.on("player_leave", (arg) => {
    toast({
      title: "le joueur " + arg + " a quitté la partie.",
      status: "info",
      isClosable: true,
      duration: 2500,
    });
  });
};

export const lobbyOneVsOneRemoveEvents = (socket: Socket) => {
  socket?.removeListener("first_winning_player_1vs1");
  socket?.removeListener("winning_round_1vs1");
  socket?.removeListener("draw_round_1vs1");
  socket?.removeListener("guess_word_broadcast");
  socket?.removeListener("update_word_broadcast");
  socket?.removeListener("next_round");
  socket?.removeListener("winning_game_1vs1");
  socket?.removeListener("player_leave");
};

export const leaveGame = (
  socket: Socket,
  playerId: string,
  gameId: string,
  lobbyId?: string | undefined
) => {
  socket.emit("leave_game", { playerId, lobbyId, gameId }, () => {});
};
