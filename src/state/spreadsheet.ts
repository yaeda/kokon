import { atomWithStorage } from "jotai/utils";

export const spreadsheetUrlAtom = atomWithStorage(
  "kokon:spreadsheetUrl",
  ""
);
