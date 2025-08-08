"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTrackCode = exports.getTrackName = exports.compareTrackCode = exports.TRACK_SORT_ORDER = exports.TRACK_CODES = void 0;
/**
 * 競馬場コード
 */
exports.TRACK_CODES = {
    SAPPORO: '01',
    HAKODATE: '02',
    FUKUSHIMA: '03',
    NIIGATA: '04',
    TOKYO: '05',
    NAKAYAMA: '06',
    CHUKYO: '07',
    KYOTO: '08',
    HANSHIN: '09',
    KOKURA: '10',
};
/* ★ ソート順を表す配列（index が小さいほど先に並ぶ） */
exports.TRACK_SORT_ORDER = [
    exports.TRACK_CODES.HAKODATE,
    exports.TRACK_CODES.KOKURA,
    exports.TRACK_CODES.FUKUSHIMA,
    exports.TRACK_CODES.CHUKYO,
    exports.TRACK_CODES.NIIGATA,
    exports.TRACK_CODES.SAPPORO,
    exports.TRACK_CODES.KYOTO,
    exports.TRACK_CODES.HANSHIN,
    exports.TRACK_CODES.TOKYO,
    exports.TRACK_CODES.NAKAYAMA, // 10
];
/* ソート用コンパレータ */
const compareTrackCode = (a, b) => exports.TRACK_SORT_ORDER.indexOf(a) - exports.TRACK_SORT_ORDER.indexOf(b);
exports.compareTrackCode = compareTrackCode;
/* 競馬場コード→名前 */
const TRACK_NAMES = {
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
const getTrackName = (code) => TRACK_NAMES[code] ?? '不明';
exports.getTrackName = getTrackName;
/* 名前→コード（逆引き） */
const NAME_TO_CODE = Object.fromEntries(Object.entries(TRACK_NAMES).map(([c, n]) => [n, c]));
const getTrackCode = (name) => NAME_TO_CODE[name] ?? '';
exports.getTrackCode = getTrackCode;
