"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG = exports.USER_AGENTS = void 0;
require("dotenv/config");
exports.USER_AGENTS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';
exports.CONFIG = {
    NETKEIBA: {
        BASE_URL: 'https://race.netkeiba.com/top/race_list.html',
        USERNAME: process.env.NETKEIBA_USERNAME || 'k-mochizuki@ace-mgmt.co.jp',
        PASSWORD: process.env.NETKEIBA_PASSWORD || '5v2PFveaAvBL4E9'
    },
    WINKEIBA: {
        BASE_URL: 'https://www.winkeiba.jp',
        USERNAME: process.env.WINKEIBA_USERNAME || 'motomurakensaku@gmail.com',
        PASSWORD: process.env.WINKEIBA_PASSWORD || 'Motomura11'
    },
    REQUEST_INTERVAL: 30000,
    TIMEOUT: 30000, // 30秒
};
