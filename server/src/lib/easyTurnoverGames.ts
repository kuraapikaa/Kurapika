/**
 * Anapara çevrimi kolay (exploitable) oyunlar listesi.
 * Kaynak: https://docs.google.com/spreadsheets/d/1MGMd1b5ORyOPQcJyxvfLv3jLI-wTke8RfuQi2s5fG0E
 * Withdraw kontrolünde bu oyunlardan oynanmışsa soft uyarı verilir.
 */
export const EASY_TURNOVER_GAME_NAMES: string[] = [
  'Dead or Alive 2',
  'Vampires',
  'The True Sheriff',
  'The Ninja',
  'Avalon',
  'Castle Builder',
  'Castle Builder 2',
  'Good to go',
  'Hellboy',
  'Immortal Romance',
  'Joker 8000',
  'Lucky Little Gods',
  'Drive: Multiplier Mayhem',
  'Jack and the Beanstalk',
  'Jack Hammer',
  'Jack Hammer 2: Fishy Business',
  'Joker Pro',
  'Koi Princess',
  'Mega Joker',
  'Reel Rush',
  'Secrets of Atlantis',
  'Steam Tower',
  'Victorious',
  'Aztec Idols',
  'Book of Dead',
  'GEMiX',
  'Leprechaun Goes to Hell',
  'Moon Princess',
  'Multifruit 81',
  'Pearls of India',
  'Reactoonz',
  'Royal Masquerade',
  'Tower Quest',
  'Viking Runecraft',
  'Power Force Villains',
  'Treasure Island',
  'Laser Fruit',
  'Lucky Little Devil',
  'Mystery Reels',
  'Wild Circus',
  'Voodoo Gold',
  'Cygnus',
  'Adventure Palace',
  "Dr. Jedkyll & Mr. Hyde",
  "Devil's Delight",
  'Dragon Ship',
  'Golden Legend',
  "Guns N' Roses",
  'Happy Halloween',
  'Holiday Season',
  'Hugo 2',
  'Medusa',
  'Pimped',
  'Pinocchio',
  'Riches of RA',
  'Sea Hunter',
  'SpectacularWheel of Wealth',
  'The Wish Master',
  'Thunderstruck',
  'Untamed Bengal Tiger',
  'Untamed Wolf Pack',
  'Vikings Go Berzerk',
  'Wheel of Wealth',
  'Wheel of Wealth Special Edition',
  'Extra Chilli',
  'Bonanza',
  'Ecuador Gold',
  'Legacy of Dead',
  'Mongol Treasure',
  'Minotaurus',
  'Voodoo',
  'Voodoo Dice',
  'Rise of Merlin',
  'Flame Busters',
  'Fruit Warp',
  'Pink Elephants',
  'Rocket Fellas Inc',
  'The Falcon Huntress',
  'Midas Golden Touch',
  'Dragon Horn',
  'Ravens Eye',
  'Riders of the Storm',
  'Divine Lotus',
  'Sword of Khans',
  'Esqueleto Explosivo 2',
  'Dawn of Egypt',
  'Agent Jane Blonde',
  'Agent Valkyrie',
  'Alchymedes',
  "Alhemist's gold",
  'Art of the heist',
  'Astro Legends: Lyra and Erion',
  'Avalon II',
  "Baker's Treat",
  'Baron Samedi',
  'Battle Royal',
  'Beautiful Bones',
  'Berryburst MAX',
  'Bikini Party',
];

const NORMALIZED_SET = new Set(
  EASY_TURNOVER_GAME_NAMES.map((n) => n.trim().toLowerCase()).filter(Boolean)
);

/** Verilen oyun adının kolay çevrim listesinde olup olmadığını (case-insensitive) döner. */
export function isEasyTurnoverGame(gameName: string | null | undefined): boolean {
  if (gameName == null || String(gameName).trim() === '') return false;
  return NORMALIZED_SET.has(String(gameName).trim().toLowerCase());
}

/** Oynanan oyun adları listesinden kolay çevrim listesinde olanları döner. */
export function findPlayedEasyTurnoverGames(playedNames: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const name of playedNames) {
    if (name == null) continue;
    const s = String(name).trim();
    if (!s || seen.has(s.toLowerCase())) continue;
    if (NORMALIZED_SET.has(s.toLowerCase())) {
      seen.add(s.toLowerCase());
      out.push(s);
    }
  }
  return out;
}
