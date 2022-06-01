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
  Stack,
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
  lobby: { name, totalPlace, state, playerList, id, owner, mode, lastGame },
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
    <>
      <Box pt={8} pl={8}>
        {lastGame != null && (
          <>
            <Box fontSize={"3xl"} fontWeight={"bold"}>
              Dernière partie
            </Box>
            <Box>
              <Text fontWeight={"bold"}>Mode de jeu :</Text> {lastGame.gameMode}
            </Box>
            <Box>
              <Text fontWeight={"bold"}>Liste des joueurs :</Text>
              {lastGame.playerList.map((player) => player.name + ", ")}
            </Box>
            <Box>
              <Text fontWeight={"bold"}>Gagnant : </Text>
              {lastGame.winner ? lastGame.winner : "Egalité"}
            </Box>
            <Box>
              <Text fontWeight={"bold"}>Mot(s) à deviner : </Text>
              <Stack spacing={1}>
                {lastGame.wordsToGuess.map((word, index) => (
                  <Text key={index}>
                    {word[0].toUpperCase() + word.slice(1)}
                  </Text>
                ))}
              </Stack>
            </Box>
          </>
        )}
      </Box>
      <Flex direction={"column"} alignContent={"center"}>
        <Box mx="auto">
          <Text fontSize={"4xl"}>
            {name} - {mode} - {placeStatus}
          </Text>
        </Box>

        <Text fontSize={"2xl"}>Joueurs</Text>
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
                    {player.name} {player.id === playerId && "(Vous)"}
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
    </>
  );
};
