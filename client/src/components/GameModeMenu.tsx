import { Stack, Button, Text, useDisclosure } from "@chakra-ui/react";
import React from "react";
import { useRouter } from "next/router";
import { CreatePlayerModal } from "./CreatePlayerModal";

interface GameModeMenuProps {}

export const GameModeMenu: React.FC<GameModeMenuProps> = ({}) => {
  const router = useRouter();

  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <Stack spacing={4} direction="column" align="center">
      <Text fontWeight={"bold"} fontSize="2xl">
        Sélectionnez un mode de jeu :
      </Text>
      <Stack w={240} spacing={4}>
        <Button
          onClick={() => router.push("/solo")}
          colorScheme="teal"
          w="100%"
          variant={"outline"}
        >
          Solo
        </Button>
        <Button
          onClick={onOpen}
          colorScheme="teal"
          w="100%"
          variant={"outline"}
        >
          Multijoueur
        </Button>
        {/* <Button
          onClick={() => router.push("/lobby")}
          colorScheme="teal"
          w="100%"
          variant={"outline"}
        >
          aller aux lobbies
        </Button> */}
      </Stack>
      <CreatePlayerModal isOpen={isOpen} onClose={onClose} />
    </Stack>
  );
};
