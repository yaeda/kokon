import { atomWithStorage } from "jotai/utils";

export const speechEnabledAtom = atomWithStorage("kokon:speechEnabled", false);
export const themeAtom = atomWithStorage<"dark" | "light" | "system">(
  "kokon:theme",
  "system"
);
