// Block type registry and properties.
// Every block has: name, solidity, transparency, texture tiles per face.

export const BLOCK = Object.freeze({
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  WATER: 5,
  WOOD: 6,
  LEAVES: 7,
  BEDROCK: 8,
  PLANKS: 9,
  COBBLE: 10,
  GLASS: 11,
  BRICK: 12,
  SNOW: 13,
});

export const BLOCK_DATA = {
  [BLOCK.AIR]:    { name: 'Air',        solid: false, transparent: true,  placeable: false, liquid: false, tiles: null },
  [BLOCK.GRASS]:  { name: 'Grass',      solid: true,  transparent: false, placeable: true,  liquid: false,
                    tiles: { top: 'grass_top', side: 'grass_side', bottom: 'dirt' } },
  [BLOCK.DIRT]:   { name: 'Dirt',       solid: true,  transparent: false, placeable: true,  liquid: false,
                    tiles: { top: 'dirt', side: 'dirt', bottom: 'dirt' } },
  [BLOCK.STONE]:  { name: 'Stone',      solid: true,  transparent: false, placeable: true,  liquid: false,
                    tiles: { top: 'stone', side: 'stone', bottom: 'stone' } },
  [BLOCK.SAND]:   { name: 'Sand',       solid: true,  transparent: false, placeable: true,  liquid: false,
                    tiles: { top: 'sand', side: 'sand', bottom: 'sand' } },
  [BLOCK.WATER]:  { name: 'Water',      solid: false, transparent: true,  placeable: true,  liquid: true,
                    tiles: { top: 'water', side: 'water', bottom: 'water' } },
  [BLOCK.WOOD]:   { name: 'Wood',       solid: true,  transparent: false, placeable: true,  liquid: false,
                    tiles: { top: 'wood_top', side: 'wood_side', bottom: 'wood_top' } },
  [BLOCK.LEAVES]: { name: 'Leaves',     solid: true,  transparent: true,  placeable: true,  liquid: false,
                    tiles: { top: 'leaves', side: 'leaves', bottom: 'leaves' } },
  [BLOCK.BEDROCK]:{ name: 'Bedrock',    solid: true,  transparent: false, placeable: true,  liquid: false,
                    tiles: { top: 'bedrock', side: 'bedrock', bottom: 'bedrock' } },
  [BLOCK.PLANKS]: { name: 'Planks',     solid: true,  transparent: false, placeable: true,  liquid: false,
                    tiles: { top: 'planks', side: 'planks', bottom: 'planks' } },
  [BLOCK.COBBLE]: { name: 'Cobblestone',solid: true,  transparent: false, placeable: true,  liquid: false,
                    tiles: { top: 'cobble', side: 'cobble', bottom: 'cobble' } },
  [BLOCK.GLASS]:  { name: 'Glass',      solid: true,  transparent: true,  placeable: true,  liquid: false,
                    tiles: { top: 'glass', side: 'glass', bottom: 'glass' } },
  [BLOCK.BRICK]:  { name: 'Brick',      solid: true,  transparent: false, placeable: true,  liquid: false,
                    tiles: { top: 'brick', side: 'brick', bottom: 'brick' } },
  [BLOCK.SNOW]:   { name: 'Snow',       solid: true,  transparent: false, placeable: true,  liquid: false,
                    tiles: { top: 'snow', side: 'snow', bottom: 'snow' } },
};

// Hotbar default — 9 slots for quick access
export const HOTBAR_BLOCKS = [
  BLOCK.GRASS,
  BLOCK.DIRT,
  BLOCK.STONE,
  BLOCK.SAND,
  BLOCK.WOOD,
  BLOCK.PLANKS,
  BLOCK.COBBLE,
  BLOCK.GLASS,
  BLOCK.BRICK,
];

// All placeable blocks (for inventory)
export const ALL_PLACEABLE = Object.keys(BLOCK_DATA)
  .map(Number)
  .filter((id) => BLOCK_DATA[id].placeable);
