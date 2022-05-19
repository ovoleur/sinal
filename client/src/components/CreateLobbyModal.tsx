import {
  Box,
  Button,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Radio,
  RadioGroup,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import React from "react";
import { Socket } from "socket.io-client";
import { usePlayer, useSocket } from "src/utils/hooks";
import { Packet, Player } from "src/utils/types";

interface CreateLobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateLobbyModal: React.FC<CreateLobbyModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [gameMode, setGameMode] = React.useState("1vs1");
  const [isPublic, setIsPublic] = React.useState(true);
  const [lobbyName, setLobbyName] = React.useState("Nouveau Lobby");
  const [nbPlaces, setNbPlaces] = React.useState(2);
  const [maxPlaces, setmaxPlaces] = React.useState(2);
  const socket = useSocket();
  const [owner] = usePlayer();
  const router = useRouter();

  const createLobby = (socket: Socket | null, owner: Player | null) => {
    socket?.emit(
      "create_lobby",
      {
        mode: gameMode,
        place: nbPlaces,
        isPublic,
        owner,
        name: lobbyName,
      },
      (response: Packet) => {
        if(response.success) {
          router.push(`/lobby/${response.data}`);
        } else {
          console.log("createLobby client error : " + response.message);
        }
      }
    );

    onClose();
  };

  const handleKeyPressed = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      createLobby(socket, owner);
    }
  };

  const handleLobbyName = (event: any) => {
    setLobbyName(event.target.value);
  };

  const handleGameMode = (value: string) => {
    setGameMode(value);
    if (value == "battle-royale") {
      setmaxPlaces(50);
      setNbPlaces(50);
    } else if (value == "1vs1") {
      setmaxPlaces(2);
      setNbPlaces(2);
    }
  };

  const handleIsPublic = (value: string) => {
    setIsPublic(value === "true");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Création de lobby</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Box onKeyDown={handleKeyPressed}>
            <Input value={lobbyName} onChange={handleLobbyName} />
            {/* GAME MODE */}
            <Text my={2}>Mode de jeu</Text>
            <RadioGroup onChange={handleGameMode} value={gameMode}>
              <Stack direction="row">
                <Radio value="1vs1">1 vs 1</Radio>
                <Radio isDisabled={false} value="battle-royale">
                  Battle Royale
                </Radio>
                <Radio isDisabled={true} value="2vs2">
                  2 vs 2
                </Radio>
              </Stack>
            </RadioGroup>
            {/* PLACE */}
            <Text my={2}>Places</Text>
            <NumberInput
              onChange={(valueString: string) =>
                setNbPlaces(parseInt(valueString))
              }
              value={nbPlaces}
              min={2}
              max={maxPlaces}
            >
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
            {/* PUBLIC/PRIVE */}
            <Text my={2}>Visibilité</Text>
            <RadioGroup onChange={handleIsPublic} value={isPublic.toString()}>
              <Stack direction="row">
                <Radio value="true">Public</Radio>
                <Radio value="false">Privée</Radio>
              </Stack>
            </RadioGroup>
          </Box>
        </ModalBody>

        <ModalFooter>
          <Button
            colorScheme="blue"
            mr={3}
            onClick={() => createLobby(socket, owner)}
          >
            Créer lobby
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
