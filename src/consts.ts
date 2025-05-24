/**
 * 競馬場コード
 */
export const TRACK_CODES = {
  SAPPORO:  '01',
  HAKODATE: '02',
  FUKUSHIMA:'03',
  NIIGATA:  '04',
  TOKYO:    '05',
  NAKAYAMA: '06',
  CHUKYO:   '07',
  KYOTO:    '08',
  HANSHIN:  '09',
  KOKURA:   '10',
} as const;


/* ★ ソート順を表す配列（index が小さいほど先に並ぶ） */
export const TRACK_SORT_ORDER: readonly string[] = [
  TRACK_CODES.KOKURA,    // 1
  TRACK_CODES.CHUKYO,    // 2
  TRACK_CODES.FUKUSHIMA, // 3
  TRACK_CODES.NIIGATA,   // 4
  TRACK_CODES.SAPPORO,   // 5
  TRACK_CODES.HAKODATE,  // 6
  TRACK_CODES.KYOTO,     // 7
  TRACK_CODES.HANSHIN,   // 8
  TRACK_CODES.TOKYO,     // 9
  TRACK_CODES.NAKAYAMA,  // 10
] as const;

/* ソート用コンパレータ */
export const compareTrackCode = (a: string, b: string): number =>
  TRACK_SORT_ORDER.indexOf(a) - TRACK_SORT_ORDER.indexOf(b);

/* 競馬場コード→名前 */
const TRACK_NAMES: Record<string, string> = {
  '01': '札幌',
  '02': '函館',
  '03': '福島',
  '04': '新潟',
  '05': '東京',
  '06': '中山',
  '07': '中京',
  '08': '京都',
  '09': '阪神',
  '10': '小倉',
};

export const getTrackName = (code: string): string => TRACK_NAMES[code] ?? '不明';

/* 名前→コード（逆引き） */
const NAME_TO_CODE = Object.fromEntries(
  Object.entries(TRACK_NAMES).map(([c, n]) => [n, c]),
) as Record<string, string>;

export const getTrackCode = (name: string): string | '' => NAME_TO_CODE[name] ?? '';
