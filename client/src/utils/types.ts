export interface StartGameResponse {
  length: number;
  firstLetter: string;
  id: string;
  nb_life: number;
}

export interface TriesHistory {
  wordTried: string;
  result: LetterResult[];
}

export enum LetterResult {
  RIGHT_POSITION,
  FOUND,
  NOT_FOUND,
}

export type Player = {
  id: string;
  name: string;
  lobbyId: string | null;
};

export type GameMode = "1vs1" | "battle-royale";
export type LobbyState = "in-game" | "pre-game" | "finished";

export type Lobby = {
  id: string;
  state: LobbyState;
  name: string;
  totalPlace: number; // nombre de place que le lobby peut contenir en tt
  playerList: Player[];
  owner: string; // id du joueur owner
  isPublic: boolean;
  mode: GameMode;
  currentGameId: string;
  lastGame: LastGame | null;
};

export type Packet = {
  success: boolean;
  message: string;
  data: any;
};
export type UpdateLobbyJoinPayload = {
  lobby: Lobby;
};
export type UpdateLobbyLeavePayload = {
  lobbyId: string;
  lobby: Lobby | null;
};
export type Game1vs1 = {
  playerOne: { id: string; name: string; nb_life: number };
  playerTwo: { id: string; name: string; nb_life: number };
  id: string;
  length: number;
  firstLetter: string;
  endTime: number,
};

export type SoloGameState = {
  wordLength: number;
  wordId: string;
  firstLetter: string;
  nbLife: number;
  triesHistory: TriesHistory[];
  isFinished: boolean;
  hasWon: boolean;
};

export type BrGameState = {
  playerId: string;
  wordLength: number;
  wordId: string;
  firstLetter: string;
  nbLife: number;
  triesHistory: TriesHistory[];
  isFinished: boolean;
  hasWon: boolean;
};
export type PlayerBr = {
  id: string;
  name: string;
  nbLife: number;
};

export type BrGameInfo = {
  endTime: number;
  playerList: PlayerBr[];
  playerFound: PlayerBr[];
  playersLastNextRound: number;
  id: string;
  length: number;
  firstLetter: string;
  eliminationRate: number;
  globalTime: number;
  timeAfterFirstGuess: number;
};

export type KeyboardSettings = {
  onEnter: () => void;
  onKeydown: (letter: string) => void;
  onBackspace: () => void;
};

type LastGame = {
  gameMode: GameMode;
  playerList: Player[];
  winner: Player | null;
  wordsToGuess: string[];
};
export type ChatMessage = {
  content: string;
  author: string;
  id: string;
};

export type MyFocus = {
  index: number;
  isBorder: boolean;
  focusMode: FocusMode;
};

export type FocusMode = "overwrite" | "insert";

export const twoDigits = (num: number) => String(num).padStart(2, "0");
