import { Delete, Space } from "lucide-preact";
import { useState } from "preact/hooks";
import { Button } from "../ui/button";

const LETTER_ROWS = ["AZERTYUIOP", "QSDFGHJKLM", "WXCVBN"];

interface OnScreenKeyboardProps {
  value: string;
  onChange: (value: string) => void;
}

export function OnScreenKeyboard({ value, onChange }: OnScreenKeyboardProps) {
  const [uppercase, setUppercase] = useState(false);
  return (
    <div class="flex flex-col gap-2" aria-label="Clavier tactile AZERTY">
      {LETTER_ROWS.map((row) => (
        <div class="flex justify-center gap-1.5" key={row}>
          {[...row].map((letter) => (
            <Button
              class="h-11 min-w-10 px-3 text-lg font-bold"
              key={letter}
              type="button"
              variant="outline"
              onClick={() => onChange(`${value}${uppercase ? letter : letter.toLowerCase()}`)}
            >
              {uppercase ? letter : letter.toLowerCase()}
            </Button>
          ))}
        </div>
      ))}
      <div class="flex justify-center gap-2">
        <Button class="h-10" type="button" variant="outline" onClick={() => setUppercase(!uppercase)}>
          {uppercase ? "minuscules" : "MAJ"}
        </Button>
        {["é", "è", "ê", "à", "ç", "ù", "ô"].map((character) => (
          <Button class="h-10 min-w-9 px-2" key={character} type="button" variant="outline"
            onClick={() => onChange(`${value}${uppercase ? character.toUpperCase() : character}`)}>{uppercase ? character.toUpperCase() : character}</Button>
        ))}
      </div>
      <div class="flex justify-center gap-2">
        {["@", ".", "-", "_", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].map((character) => (
          <Button class="h-10 min-w-9 px-2" key={character} type="button" variant="outline"
            onClick={() => onChange(`${value}${character}`)}>{character}</Button>
        ))}
      </div>
      <div class="flex justify-center gap-2">
        <Button
          class="h-11 min-w-48"
          type="button"
          variant="outline"
          onClick={() => onChange(`${value} `)}
        >
          <Space /> Espace
        </Button>
        <Button
          class="h-11 min-w-24"
          type="button"
          variant="outline"
          aria-label="Effacer la dernière lettre"
          onClick={() => onChange(value.slice(0, -1))}
        >
          <Delete />
        </Button>
        <Button
          class="h-11"
          type="button"
          variant="ghost"
          onClick={() => onChange("")}
        >
          Effacer
        </Button>
      </div>
    </div>
  );
}
