import {
  Box,
  Button,
  Flex,
  SimpleGrid,
  Text,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import axios from "axios";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import { addLobbiesEvent, removeLobbiesEvent } from "src/utils/api";
import { CreateLobbyModal } from "../components/CreateLobbyModal";
import { CreatePlayerModal } from "../components/CreatePlayerModal";
import { Layout } from "../components/Layout";
import { LobbyProfile } from "../components/LobbyProfile";
import { serverHttpUrl } from "../utils/const";
import { usePlayer, useSocket } from "../utils/hooks";
import { Lobby } from "../utils/types";

interface PublicLobbyProps {}

const PublicLobby: React.FC<PublicLobbyProps> = ({}) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { onClose: createPlayerOnClose } = useDisclosure();
  const [player] = usePlayer();
  const socket = useSocket();
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    axios.get<Lobby[]>(`${serverHttpUrl}/list_lobbies`).then(({ data }) => {
      setLobbies(data);
    });
  }, []);

  useEffect(() => {
    if (socket && player) {
      // Update event lobbies
      addLobbiesEvent(socket, setLobbies, player, toast, router);
    }

    return () => {
      if (socket && player) {
        removeLobbiesEvent(socket);
      }
    };
  }, [socket, player]);

  return (
    <Layout variant="grid">
      <div></div>
      <Flex direction={"column"}>
        <Text mb={5} align="center" fontSize={"3xl"}>
          Liste des lobbys
        </Text>
        <Box mx="auto" my="4">
          <Button
            onClick={() => {
              console.log(player);
              onOpen();
            }}
          >
            Créer un lobby
          </Button>
        </Box>
        <SimpleGrid minChildWidth="250px" spacing="40px">
          {lobbies.map((lobby) => (
            <LobbyProfile key={lobby.id} lobby={lobby} />
          ))}
        </SimpleGrid>
      </Flex>
      <CreatePlayerModal isOpen={!player} onClose={createPlayerOnClose} />
      {player && (
        <CreateLobbyModal
          owner={player}
          isOpen={isOpen}
          onClose={onClose}
          mode="Create"
        />
      )}
    </Layout>
  );
};

export default PublicLobby;
