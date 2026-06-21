import { writeFile } from "node:fs/promises";
import { cyberXianxiaTarotDeck, tarotArtDirection } from "../src/data/cyberXianxiaTarot.js";

await writeFile(
  new URL("../docs/cyber-xianxia-tarot-deck.generated.json", import.meta.url),
  `${JSON.stringify({
    artDirection: tarotArtDirection.style,
    figureRule: tarotArtDirection.figureRule,
    colorSystem: tarotArtDirection.colorSystem,
    cardSize: tarotArtDirection.cardSize,
    cards: cyberXianxiaTarotDeck
  }, null, 2)}\n`
);
