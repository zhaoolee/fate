import { writeFile } from "node:fs/promises";
import { cyberXianxiaTarotDeck, tarotArtDirection } from "../src/data/cyberXianxiaTarot.js";

const cardsPerSheet = 12;
const columns = 4;
const rows = 3;

const sheets = [];
for (let start = 0; start < cyberXianxiaTarotDeck.length; start += cardsPerSheet) {
  const cards = cyberXianxiaTarotDeck.slice(start, start + cardsPerSheet);
  const sheetNumber = Math.floor(start / cardsPerSheet) + 1;
  const filledCells = cards.map((card, index) => {
    const row = Math.floor(index / columns) + 1;
    const column = index % columns + 1;
    return `row ${row}, column ${column}: ${card.englishName} (${card.chineseName}) - ${card.composition}`;
  });

  sheets.push({
    id: `sheet-${String(sheetNumber).padStart(2, "0")}`,
    cardIds: cards.map(card => card.id),
    layout: `${columns} columns x ${rows} rows`,
    prompt: [
      `Create one complete production contact sheet for "${tarotArtDirection.title}", ${columns} columns by ${rows} rows, containing ${cards.length} separate mini tarot artworks.`,
      "Each cell is one independent small card illustration. Keep the grid strict, evenly spaced, and easy to crop later.",
      `Art direction: ${tarotArtDirection.style}.`,
      `Character rule: ${tarotArtDirection.figureRule}`,
      `Palette system: ${tarotArtDirection.colorSystem}.`,
      "Every cell should feel like the same deck and same world, with soft otome fantasy, immortal cultivation, gentle Taoist magic, floating talismans, moonlit gardens, celestial flowers, luminous ribbons, delicate architecture, and romantic fantasy lighting.",
      "No text, no titles, no card names, no numbers, no borders inside the card art, no watermark, no logo.",
      "Do not copy any Rider-Waite-Smith, Thoth, Modern Witch, Wild Unknown, or Light Seer's composition; inherit only abstract tarot meanings.",
      "Cards by grid cell:",
      ...filledCells,
      `Negative prompt: ${tarotArtDirection.negativePrompt}`
    ].join("\n")
  });
}

await writeFile(
  new URL("../docs/cyber-xianxia-tarot-sheet-prompts.generated.json", import.meta.url),
  `${JSON.stringify({ cardsPerSheet, columns, rows, sheets }, null, 2)}\n`
);
