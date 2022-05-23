import { HStack } from "@chakra-ui/react";
import React from "react";
import { LetterResult } from "../../utils/types";
import { SmallPlayerGridCase } from "./SmallPlayerGridCase";

interface SmallPlayerGridRowProps {
  word: string;
  // firstLetter: string;
  wordLength: number;
  letterResults?: LetterResult[];
  isVisible?: boolean;
  nbPlayer:number;
}

export const SmallPlayerGridRow: React.FC<SmallPlayerGridRowProps> = ({
  word,
  wordLength: length,
  letterResults,
  isVisible,
  nbPlayer,
}) => {
  let playerRow = [...word].map((letter, index) => {
    return (
      <SmallPlayerGridCase
        key={index}
        letterResult={letterResults && letterResults[index]}
        nbPlayer={nbPlayer}
      />
    );
  });

  while (playerRow.length < length) {
    playerRow.push(
      <SmallPlayerGridCase key={playerRow.length} nbPlayer={nbPlayer} />
    );
  }

  return <HStack spacing={1}>{playerRow}</HStack>;
};