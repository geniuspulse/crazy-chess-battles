// Compact opening detection — matches PGN move sequences against known openings.
// Only covers the most common openings to keep bundle size small.

interface OpeningEntry {
  eco: string;
  name: string;
  moves: string[]; // SAN moves, lowercase first letter convention from chess.js
}

const OPENINGS: OpeningEntry[] = [
  { eco: "B00", name: "King's Pawn Opening", moves: ["e4", "e5"] },
  { eco: "C20", name: "Open Game", moves: ["e4", "e5", "Nf3", "Nc6"] },
  { eco: "C30", name: "King's Gambit", moves: ["e4", "e5", "f4"] },
  { eco: "C50", name: "Italian Game", moves: ["e4", "e5", "Nf3", "Nc6", "Bc4"] },
  { eco: "C53", name: "Italian Game: Giuoco Piano", moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"] },
  { eco: "C60", name: "Ruy Lopez", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5"] },
  { eco: "C68", name: "Ruy Lopez: Exchange", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Bxc6"] },
  { eco: "C80", name: "Ruy Lopez: Open", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Nxe4"] },
  { eco: "C42", name: "Petrov's Defense", moves: ["e4", "e5", "Nf3", "Nf6"] },
  { eco: "C41", name: "Philidor Defense", moves: ["e4", "e5", "Nf3", "d6"] },
  { eco: "B01", name: "Scandinavian Defense", moves: ["e4", "d5"] },
  { eco: "B07", name: "Pirc Defense", moves: ["e4", "d6", "d4", "Nf6"] },
  { eco: "B10", name: "Caro-Kann Defense", moves: ["e4", "c6"] },
  { eco: "B12", name: "Caro-Kann: Advance", moves: ["e4", "c6", "d4", "d5", "e5"] },
  { eco: "B13", name: "Caro-Kann: Exchange", moves: ["e4", "c6", "d4", "d5", "exd5"] },
  { eco: "B18", name: "Caro-Kann: Classical", moves: ["e4", "c6", "d4", "d5", "Nc3", "dxe4", "Nxe4", "Bf5"] },
  { eco: "B20", name: "Sicilian Defense", moves: ["e4", "c5"] },
  { eco: "B21", name: "Sicilian: Smith-Morra Gambit", moves: ["e4", "c5", "d4", "cxd4", "c3"] },
  { eco: "B22", name: "Sicilian: Alapin", moves: ["e4", "c5", "c3"] },
  { eco: "B27", name: "Sicilian: Hyperaccelerated Dragon", moves: ["e4", "c5", "Nf3", "g6"] },
  { eco: "B30", name: "Sicilian: Old Sicilian", moves: ["e4", "c5", "Nf3", "Nc6"] },
  { eco: "B33", name: "Sicilian: Sveshnikov", moves: ["e4", "c5", "Nf3", "Nc6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "e5"] },
  { eco: "B40", name: "Sicilian Defense", moves: ["e4", "c5", "Nf3", "e6"] },
  { eco: "B50", name: "Sicilian Defense", moves: ["e4", "c5", "Nf3", "d6"] },
  { eco: "B54", name: "Sicilian Defense", moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4"] },
  { eco: "B70", name: "Sicilian: Dragon", moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "g6"] },
  { eco: "B80", name: "Sicilian: Scheveningen", moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "e6"] },
  { eco: "B90", name: "Sicilian: Najdorf", moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"] },
  { eco: "C00", name: "French Defense", moves: ["e4", "e6"] },
  { eco: "C01", name: "French: Exchange", moves: ["e4", "e6", "d4", "d5", "exd5"] },
  { eco: "C02", name: "French: Advance", moves: ["e4", "e6", "d4", "d5", "e5"] },
  { eco: "C03", name: "French: Tarrasch", moves: ["e4", "e6", "d4", "d5", "Nd2"] },
  { eco: "C10", name: "French: Rubinstein", moves: ["e4", "e6", "d4", "d5", "Nc3", "dxe4"] },
  { eco: "C11", name: "French: Classical", moves: ["e4", "e6", "d4", "d5", "Nc3", "Nf6"] },
  { eco: "C15", name: "French: Winawer", moves: ["e4", "e6", "d4", "d5", "Nc3", "Bb4"] },
  { eco: "D00", name: "Queen's Pawn Opening", moves: ["d4", "d5"] },
  { eco: "D02", name: "London System", moves: ["d4", "d5", "Nf3", "Nf6", "Bf4"] },
  { eco: "D06", name: "Queen's Gambit", moves: ["d4", "d5", "c4"] },
  { eco: "D07", name: "Queen's Gambit Declined", moves: ["d4", "d5", "c4", "e6"] },
  { eco: "D10", name: "Slav Defense", moves: ["d4", "d5", "c4", "c6"] },
  { eco: "D15", name: "Slav Defense", moves: ["d4", "d5", "c4", "c6", "Nf3", "Nf6"] },
  { eco: "D20", name: "Queen's Gambit Accepted", moves: ["d4", "d5", "c4", "dxc4"] },
  { eco: "D30", name: "Queen's Gambit Declined", moves: ["d4", "d5", "c4", "e6", "Nf3", "Nf6"] },
  { eco: "D32", name: "Tarrasch Defense", moves: ["d4", "d5", "c4", "e6", "Nc3", "c5"] },
  { eco: "D35", name: "Queen's Gambit: Exchange", moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "cxd5"] },
  { eco: "D43", name: "Semi-Slav Defense", moves: ["d4", "d5", "c4", "c6", "Nf3", "Nf6", "Nc3", "e6"] },
  { eco: "D44", name: "Semi-Slav: Botvinnik", moves: ["d4", "d5", "c4", "c6", "Nf3", "Nf6", "Nc3", "e6", "Bg5", "dxc4"] },
  { eco: "D50", name: "Queen's Gambit", moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5"] },
  { eco: "D53", name: "Queen's Gambit: Be7", moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5", "Be7"] },
  { eco: "D55", name: "Queen's Gambit: Orthodox", moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5", "Be7", "e3", "O-O", "Nf3", "h6"] },
  { eco: "D70", name: "Neo-Grunfeld", moves: ["d4", "Nf6", "g3", "g6"] },
  { eco: "D80", name: "Grunfeld Defense", moves: ["d4", "Nf6", "c4", "g6"] },
  { eco: "D85", name: "Grunfeld: Exchange", moves: ["d4", "Nf6", "c4", "g6", "Nc3", "d5", "cxd5", "Nxd5", "e4"] },
  { eco: "E00", name: "Indian Defense", moves: ["d4", "Nf6"] },
  { eco: "E01", name: "Catalan Opening", moves: ["d4", "Nf6", "c4", "e6", "g3"] },
  { eco: "E04", name: "Catalan: Open", moves: ["d4", "Nf6", "c4", "e6", "g3", "d5", "Bg2", "dxc4"] },
  { eco: "E10", name: "Indian: Blumenfeld", moves: ["d4", "Nf6", "c4", "e6", "Nf3", "c5"] },
  { eco: "E11", name: "Indian: Bogoljubow", moves: ["d4", "Nf6", "c4", "e6", "Nf3", "Bb4+"] },
  { eco: "E12", name: "Queen's Indian Defense", moves: ["d4", "Nf6", "c4", "e6", "Nf3", "b6"] },
  { eco: "E15", name: "Queen's Indian", moves: ["d4", "Nf6", "c4", "e6", "Nf3", "b6", "g3"] },
  { eco: "E20", name: "Nimzo-Indian Defense", moves: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"] },
  { eco: "E21", name: "Nimzo-Indian: Three Knights", moves: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4", "Nf3"] },
  { eco: "E32", name: "Nimzo-Indian: Classical", moves: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4", "Qc2"] },
  { eco: "E60", name: "King's Indian Defense", moves: ["d4", "Nf6", "c4", "g6"] },
  { eco: "E61", name: "King's Indian Defense", moves: ["d4", "Nf6", "c4", "g6", "Nc3"] },
  { eco: "E70", name: "King's Indian Defense", moves: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4"] },
  { eco: "E76", name: "King's Indian: Four Pawns", moves: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6", "f4"] },
  { eco: "E80", name: "King's Indian: Samisch", moves: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6", "f3"] },
  { eco: "E90", name: "King's Indian: Classical", moves: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6", "Nf3", "O-O"] },
  { eco: "E92", name: "King's Indian: Classical", moves: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6", "Nf3", "O-O", "Be2", "e5"] },
  { eco: "A00", name: "Uncommon Opening", moves: [] },
  { eco: "A40", name: "Queen's Pawn Opening", moves: ["d4"] },
  { eco: "A45", name: "Indian Game", moves: ["d4", "Nf6"] },
  { eco: "A46", name: "Indian: Knights Variation", moves: ["d4", "Nf6", "Nf3"] },
  { eco: "A56", name: "Benoni Defense", moves: ["d4", "Nf6", "c4", "c5"] },
  { eco: "A57", name: "Benko Gambit", moves: ["d4", "Nf6", "c4", "c5", "d5", "b5"] },
  { eco: "A60", name: "Benoni Defense", moves: ["d4", "Nf6", "c4", "c5", "d5", "e6"] },
  { eco: "A80", name: "Dutch Defense", moves: ["d4", "f5"] },
  { eco: "A84", name: "Dutch: Classical", moves: ["d4", "f5", "c4", "Nf6", "g3", "e6", "Nf3"] },
  { eco: "A90", name: "Dutch: Stonewall", moves: ["d4", "f5", "g3", "Nf6", "Bg2", "e6", "Nf3", "d5", "O-O", "Bd6"] },
  { eco: "B06", name: "Modern Defense", moves: ["e4", "g6"] },
  { eco: "B20", name: "Sicilian Defense", moves: ["e4", "c5", "Nf3"] },
  { eco: "E12", name: "Queen's Indian Defense", moves: ["d4", "Nf6", "c4", "e6", "Nf3", "b6"] },
];

export function detectOpening(moves: string[]): OpeningEntry | null {
  if (moves.length < 1) return null;
  
  let bestMatch: OpeningEntry | null = null;
  let bestMatchLength = 0;

  for (const opening of OPENINGS) {
    if (opening.moves.length === 0) continue;
    if (opening.moves.length > moves.length) continue;
    
    let matches = true;
    for (let i = 0; i < opening.moves.length; i++) {
      if (moves[i] !== opening.moves[i]) {
        matches = false;
        break;
      }
    }
    
    if (matches && opening.moves.length > bestMatchLength) {
      bestMatch = opening;
      bestMatchLength = opening.moves.length;
    }
  }

  return bestMatch;
}
