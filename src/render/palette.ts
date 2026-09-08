/** 숫자·타일 색상 단일 출처 (docs/ART_STYLE.md 와 동기화). */

export interface NumberColor {
  name: string;
  base: string;
  light: string;
  dark: string;
  /** 텐처럼 두 가지 색을 번갈아 쓰는 경우 */
  alt?: string;
}

export const NUMBER_COLORS: Record<number, NumberColor> = {
  1: { name: '원', base: '#e8453c', light: '#ff7d70', dark: '#a52a24' },
  2: { name: '투', base: '#f2872f', light: '#ffb26a', dark: '#ad5a15' },
  3: { name: '쓰리', base: '#f7cf3e', light: '#ffe98a', dark: '#b8930f' },
  4: { name: '포', base: '#57b947', light: '#8fe07f', dark: '#2f7d25' },
  5: { name: '파이브', base: '#3fb8e8', light: '#87dcff', dark: '#1d7ba6' },
  6: { name: '식스', base: '#3557c9', light: '#7288f0', dark: '#1e3383' },
  7: { name: '세븐', base: '#8c4fd0', light: '#bd8bf5', dark: '#5b2b91' },
  8: { name: '에이트', base: '#ee5fa7', light: '#ff9ac9', dark: '#a83370' },
  9: { name: '나인', base: '#1fb8a4', light: '#66e6d3', dark: '#0f7b6d' },
  10: { name: '텐', base: '#e8453c', light: '#ff7d70', dark: '#a52a24', alt: '#f4f4f8' },
};

export const COLORS = {
  outline: '#20232e',
  skyTop: '#4aa9f5',
  skyBottom: '#a8dcff',
  mountainFar: '#7fc98d',
  mountainNear: '#63b276',
  hill: '#4fae5c',
  grass: '#5fcf5a',
  grassDark: '#3d9c3c',
  dirt: '#b3722f',
  dirtDark: '#8b5420',
  brick: '#c9773c',
  brickDark: '#8b4d22',
  question: '#f2c13d',
  questionDark: '#a9791a',
  stone: '#9aa3b5',
  stoneDark: '#666f82',
  coin: '#ffd84d',
  coinDark: '#e0a51a',
  lava: '#ff6b2b',
  lavaLight: '#ffd04d',
  spike: '#cfd6e4',
  spikeDark: '#7c8698',
  cloud: '#ffffff',
  hudBg: 'rgba(18,22,36,0.82)',
  white: '#ffffff',
} as const;

/** 무지개 다리 색 순환 */
export const RAINBOW = ['#e8453c', '#f2872f', '#f7cf3e', '#57b947', '#3fb8e8', '#3557c9', '#8c4fd0'];

/** 동굴 스테이지처럼 배경 색만 바뀌는 테마 */
export interface Theme {
  skyTop: string;
  skyBottom: string;
  mountainFar: string;
  mountainNear: string;
  hill: string;
  dark: boolean;
}

export const THEMES: Record<string, Theme> = {
  field: {
    skyTop: '#4aa9f5',
    skyBottom: '#a8dcff',
    mountainFar: '#7fc98d',
    mountainNear: '#63b276',
    hill: '#4fae5c',
    dark: false,
  },
  hill: {
    skyTop: '#f2a35e',
    skyBottom: '#ffd9a0',
    mountainFar: '#c98b6a',
    mountainNear: '#a86f52',
    hill: '#8f5f45',
    dark: false,
  },
  canyon: {
    skyTop: '#5f6fd6',
    skyBottom: '#c0b6ff',
    mountainFar: '#8f7fd6',
    mountainNear: '#6f5fb8',
    hill: '#5a4d9c',
    dark: false,
  },
  cave: {
    skyTop: '#181c2e',
    skyBottom: '#2a2f4a',
    mountainFar: '#242a44',
    mountainNear: '#1c2138',
    hill: '#151a2c',
    dark: true,
  },
  tower: {
    skyTop: '#12101f',
    skyBottom: '#3a2350',
    mountainFar: '#2a1d40',
    mountainNear: '#1d1430',
    hill: '#160f26',
    dark: true,
  },
};
