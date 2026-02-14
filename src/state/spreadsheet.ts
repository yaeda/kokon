import { atomWithStorage } from "jotai/utils";

export const spreadsheetUrlAtom = atomWithStorage(
  "kokon:spreadsheetUrl",
  "https://docs.google.com/spreadsheets/d/1VnJ09LZ8zyXTkL8fgBNML3-OX094LFrKiWPGqf6gN6g/edit?usp=sharing"
);
