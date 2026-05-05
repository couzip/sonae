// 災害種別ごとの色トーン (cockpit 美学に合わせた muted な濃色 + alpha)
// rgba を返すので Tailwind ではなく inline style で利用する

export interface DisasterTone {
  border: string;
  fill: string;
  text: string;
}

const TONES: Record<string, DisasterTone> = {
  地震:        { border: 'rgba(217, 119, 6, 0.65)',  fill: 'rgba(217, 119, 6, 0.16)',  text: 'rgba(251, 191, 36, 0.95)' },
  津波:        { border: 'rgba(8, 145, 178, 0.7)',   fill: 'rgba(8, 145, 178, 0.18)',  text: 'rgba(103, 232, 249, 0.95)' },
  洪水:        { border: 'rgba(37, 99, 235, 0.65)',  fill: 'rgba(37, 99, 235, 0.18)',  text: 'rgba(147, 197, 253, 0.95)' },
  内水氾濫:    { border: 'rgba(37, 99, 235, 0.55)',  fill: 'rgba(37, 99, 235, 0.14)',  text: 'rgba(147, 197, 253, 0.9)'  },
  高潮:        { border: 'rgba(13, 148, 136, 0.65)', fill: 'rgba(13, 148, 136, 0.18)', text: 'rgba(94, 234, 212, 0.95)' },
  土砂災害:    { border: 'rgba(146, 64, 14, 0.7)',   fill: 'rgba(146, 64, 14, 0.18)',  text: 'rgba(253, 186, 116, 0.95)' },
  風水害:      { border: 'rgba(71, 85, 105, 0.7)',   fill: 'rgba(71, 85, 105, 0.18)',  text: 'rgba(203, 213, 225, 0.95)' },
  火山噴火:    { border: 'rgba(126, 34, 206, 0.65)', fill: 'rgba(126, 34, 206, 0.16)', text: 'rgba(216, 180, 254, 0.95)' },
  雪害:        { border: 'rgba(100, 116, 139, 0.6)', fill: 'rgba(100, 116, 139, 0.15)',text: 'rgba(226, 232, 240, 0.9)'  },
  竜巻:        { border: 'rgba(20, 184, 166, 0.6)',  fill: 'rgba(20, 184, 166, 0.15)', text: 'rgba(153, 246, 228, 0.95)' },
  大規模火災:  { border: 'rgba(194, 65, 12, 0.7)',   fill: 'rgba(194, 65, 12, 0.18)',  text: 'rgba(254, 215, 170, 0.95)' },
  林野火災:    { border: 'rgba(194, 65, 12, 0.65)',  fill: 'rgba(194, 65, 12, 0.16)',  text: 'rgba(254, 215, 170, 0.95)' },
  危険物災害:  { border: 'rgba(133, 77, 14, 0.7)',   fill: 'rgba(133, 77, 14, 0.18)',  text: 'rgba(253, 224, 71, 0.95)' },
  化学物質災害:{ border: 'rgba(133, 77, 14, 0.65)',  fill: 'rgba(133, 77, 14, 0.16)',  text: 'rgba(253, 224, 71, 0.95)' },
  放射性物質災害:{ border: 'rgba(101, 163, 13, 0.6)',fill: 'rgba(101, 163, 13, 0.16)', text: 'rgba(190, 242, 100, 0.95)' },
  海上災害:    { border: 'rgba(30, 64, 175, 0.65)',  fill: 'rgba(30, 64, 175, 0.18)',  text: 'rgba(165, 180, 252, 0.95)' },
  鉄道災害:    { border: 'rgba(82, 82, 91, 0.7)',    fill: 'rgba(82, 82, 91, 0.18)',   text: 'rgba(212, 212, 216, 0.95)' },
  道路災害:    { border: 'rgba(82, 82, 91, 0.7)',    fill: 'rgba(82, 82, 91, 0.18)',   text: 'rgba(212, 212, 216, 0.95)' },
  航空災害:    { border: 'rgba(82, 82, 91, 0.7)',    fill: 'rgba(82, 82, 91, 0.18)',   text: 'rgba(212, 212, 216, 0.95)' },
  大規模事故:  { border: 'rgba(82, 82, 91, 0.7)',    fill: 'rgba(82, 82, 91, 0.18)',   text: 'rgba(212, 212, 216, 0.95)' },
  都市災害:    { border: 'rgba(120, 113, 108, 0.7)', fill: 'rgba(120, 113, 108, 0.16)',text: 'rgba(231, 229, 228, 0.95)' },
  帰宅困難者:  { border: 'rgba(217, 119, 6, 0.55)',  fill: 'rgba(217, 119, 6, 0.13)',  text: 'rgba(251, 191, 36, 0.9)' },
  雑踏事故:    { border: 'rgba(120, 113, 108, 0.65)',fill: 'rgba(120, 113, 108, 0.15)',text: 'rgba(231, 229, 228, 0.9)' },
  不発弾災害:  { border: 'rgba(133, 77, 14, 0.55)',  fill: 'rgba(133, 77, 14, 0.14)',  text: 'rgba(253, 224, 71, 0.9)' },
};

const FALLBACK: DisasterTone = {
  border: 'rgba(82, 82, 91, 0.65)',
  fill: 'rgba(82, 82, 91, 0.15)',
  text: 'rgba(212, 212, 216, 0.9)',
};

export function disasterTone(jpType: string): DisasterTone {
  return TONES[jpType] ?? FALLBACK;
}
