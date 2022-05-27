import { ArrowBackIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  Divider,
  Flex,
  HStack,
  IconButton,
  List,
  ListIcon,
  ListItem,
  Text,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import React from "react";
import { GameMode, Lobby, Player } from "../utils/types";
import { isLobbyJoinable } from "../utils/utils";
import { GiLaurelCrown } from "react-icons/gi";
import { useSocket } from "../utils/hooks";

interface PreGameLobbyProps {
  lobby: Lobby;
  player: Player;
  gameMode:GameMode;
}

export const PreGameLobby: React.FC<PreGameLobbyProps> = ({
  lobby: { name, totalPlace, state, playerList, id, owner, mode },
  player: { id: playerId },
  gameMode,
}) => {
  const socket = useSocket();
  const router = useRouter();

  const currentPlace = playerList.length;

  const startGame = () => {
    if(gameMode === "battle-royale") {
      console.log("startGame : battle-royale");
      socket?.emit("start_game_br", { lobbyId: id, playerId, eliminationRate:10000, globalTime:180000, timeAfterFirstGuess:30000 });
    } else {
      socket?.emit("start_game", { lobbyId: id, playerId });
    }
  };

  const placeStatus = isLobbyJoinable(currentPlace, totalPlace, state)
    ? `En attente de joueur ${currentPlace}/${totalPlace}`
    : "Plein";

  return (
    <Flex direction={"column"} alignContent={"center"}>
      <Box mx="auto">
        <Text fontSize={"4xl"}>
          {name} - {mode} - {placeStatus}
        </Text>
      </Box>

      <Text fontSize={"2xl"}>Players</Text>
      <Divider />
      <List>
        {playerList.map((player) => {
          return (
            <ListItem key={player.id}>
              <HStack>
                {player.id === owner && (
                  <ListIcon as={GiLaurelCrown} color="green.500" />
                )}
                <Text fontSize={"xl"}>
                  {player.name} {player.id === playerId && "(You)"}
                </Text>
              </HStack>
            </ListItem>
          );
        })}
      </List>
      <HStack mx="auto">
        <IconButton
          aria-label="quit lobby"
          icon={<ArrowBackIcon />}
          onClick={() => router.push("/lobby")}
        />
        <Button
          isDisabled={playerId !== owner || playerList.length < totalPlace}
          colorScheme={"green"}
          onClick={startGame}
        >
          Commencer
        </Button>
      </HStack>
    </Flex>
  );
};
