import { ArrowBackIcon, SettingsIcon } from "@chakra-ui/icons";
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
import { Lobby, Player } from "../utils/types";
import { isLobbyJoinable } from "../utils/utils";
import { GiLaurelCrown } from "react-icons/gi";
import { useSocket } from "../utils/hooks";

interface PreGameLobbyProps {
  lobby: Lobby;
  player: Player;
}

export const PreGameLobby: React.FC<PreGameLobbyProps> = ({
  lobby: { name, totalPlace, state, playerList, id, owner, mode },
  player: { id: playerId },
}) => {
  const socket = useSocket();
  const router = useRouter();

  const currentPlace = playerList.length;

  const startGame = () => {
    socket?.emit("start_game_1vs1", { lobbyId: id, playerId });
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
        <IconButton
          aria-label="option lobby"
          icon={<SettingsIcon />}
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
