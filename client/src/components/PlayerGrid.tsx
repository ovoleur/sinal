import {
  Button,
  HStack,
  PinInput,
  PinInputField,
  Stack,
} from "@chakra-ui/react";
import React, { useContext, useState } from "react";
import { DictionaryContext } from "../utils/dico";

interface PlayerGridProps {
  firstLetter: string;
  length: number;
  nbLife: number;
}

export const PlayerGrid: React.FC<PlayerGridProps> = ({
  firstLetter,
  length,
  nbLife,
}) => {
  const dictionary = useContext(DictionaryContext);
  const [word, setWord] = useState(firstLetter);
  const [tryCount, setTryCount] = useState(0);
  const [lastTries, setLastTries] = useState<string[]>([]);

  const handleWordChange = (str: string) => {
    const re = /\d+/g;
    if (str.charAt(0) === firstLetter && !re.test(str)) {
      setWord(str);
    }
  };

  const handleTryWord = () => {
    if (!dictionary.has(word)) {
      console.log("Not in dictionary");
    } else if(word.length == length) {
      setTryCount((v) => (v = v + 1));
      const tries = lastTries.slice();
      tries.push(word);
      setWord(firstLetter);
      setLastTries(tries);
    }
  };

  const inputArrayField = [];
  for (let i = 0; i < length; i++) {
    inputArrayField.push(<PinInputField key={i} />);
  }
  const inputArray = [];
  for (let i = 0; i < nbLife; i++) {
    let value = firstLetter;
    if (i < lastTries.length) {
      value = lastTries[i];
    }

    inputArray.push(
      <HStack key={i}>
        <PinInput
          isDisabled={i != tryCount}
          onChange={handleWordChange}
          value={i != tryCount ? value : word}
          type="alphanumeric"
          placeholder="?"
        >
          {inputArrayField}
        </PinInput>
      </HStack>
    );
  }

  return (
    <Stack spacing={5} align={"center"}>
      {inputArray}
      <Button onClick={handleTryWord} mt={4}>
        try word
      </Button>
    </Stack>
  );
};