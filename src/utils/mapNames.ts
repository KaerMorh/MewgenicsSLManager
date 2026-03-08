import type { Lang } from "../i18n";

const MAP_NAMES: Record<string, Record<Lang, string>> = {
  tutorial:   { zh: "小径",     en: "The Path" },
  alley:      { zh: "后巷",     en: "The Alley" },
  sewers:     { zh: "下水道",   en: "The Sewers" },
  junkyard:   { zh: "垃圾场",   en: "The Junkyard" },
  caves:      { zh: "洞穴",     en: "The Caves" },
  boneyard:   { zh: "乱葬岗",   en: "The Boneyard" },
  meatworld:  { zh: "搏动禁域", en: "The Throbbing Domain" },
  desert:     { zh: "荒漠",     en: "The Desert" },
  crater:     { zh: "陨石坑",   en: "The Crater" },
  bunker:     { zh: "地堡",     en: "The Bunker" },
  moon:       { zh: "月球",     en: "The Moon" },
  core:       { zh: "地核",     en: "The Core" },
  dimensionx: { zh: "裂隙",     en: "The Rift" },
  lab:        { zh: "实验室",   en: "The Lab" },
  iceage:     { zh: "冰河世纪", en: "The Ice Age" },
  future:     { zh: "未来",     en: "Das Füture" },
  jurassic:   { zh: "侏罗纪",   en: "The Jurassic" },
  theend:     { zh: "终焉",     en: "The End" },
  endoftime:  { zh: "无尽",     en: "The Infinite" },
};

export function getMapDisplayName(mapId: string | null | undefined, lang: Lang): string | null {
  if (!mapId) return null;
  const entry = MAP_NAMES[mapId];
  if (!entry) return mapId;
  return entry[lang];
}
