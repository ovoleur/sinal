import { Box, HStack } from "@chakra-ui/react";
import React from "react";
import { Game1vs1, Player } from "../utils/types";
import { PlayerGrid } from "./PlayerGrid";

interface InGameLobbyProps {
  player: Player;
  gameState: Game1vs1;
  lobbyId:string | null,
}

export const InGameLobby: React.FC<InGameLobbyProps> = ({
  player,
  gameState: {
    first_letter,
    id: game_id,
    length: game_length,
    nb_life: game_nb_life,
  },
  lobbyId,
}) => {
  return (
    <Box>
      <HStack>
        <PlayerGrid
          isPlayer={true}
          isSolo={false}
          firstLetter={first_letter}
          length={game_length}
          nbLife={game_nb_life}
          id={game_id}
          player={player}
          lobbyId={lobbyId}
        ></PlayerGrid>
        <PlayerGrid
          isPlayer={false}
          isSolo={false}
          firstLetter={first_letter}
          length={game_length}
          nbLife={game_nb_life}
          id={game_id}
          player={player}
          lobbyId={lobbyId}
        ></PlayerGrid>
      </HStack>
    </Box>
  );
};