"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveAnalysisToExcel = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const XLSX = __importStar(require("xlsx"));
const consts_1 = require("./consts");
/**
 * 分析データをExcelファイルに保存する関数
 * @param analysisItems 分析データの配列
 * @param filename 保存するファイル名
 */
function saveAnalysisToExcel(analysisItems, filename) {
    const dirPath = path_1.default.join('data');
    if (!fs_1.default.existsSync(dirPath)) {
        fs_1.default.mkdirSync(dirPath, { recursive: true });
    }
    // レース結果のヘッダー
    const resultHeaders = [
        "レース名",
        "芝・ダート",
        "距離",
        "1着",
        "2着",
        "3着",
        "1着（人気）",
        "2着（人気）",
        "3着（人気）",
        "単勝",
        "複勝1",
        "複勝2",
        "複勝3",
        "馬連",
        "3連複",
        "3連単",
        "WIN5フラグ"
    ];
    const umaxPredictionHeaders = [
        "UMAX予想1",
        "UMAX予想2",
        "UMAX予想3",
        "UMAX予想4",
        "UMAX予想5",
        "UMAXタイム偏差1",
        "UMAXタイム偏差2",
        "UMAXタイム偏差3",
        "UMAX上がり偏差1",
        "UMAX上がり偏差2",
        "UMAX上がり偏差3",
        "UMAX-SP値1",
        "UMAX-SP値2",
        "UMAX-SP値3",
        "UMAX-SP値4",
        "UMAX-SP値5",
        "UMAX-AG値1",
        "UMAX-AG値2",
        "UMAX-AG値3",
        "UMAX-AG値4",
        "UMAX-AG値5",
        "UMAX-SA値1",
        "UMAX-SA値2",
        "UMAX-SA値3",
        "UMAX-SA値4",
        "UMAX-SA値5",
        "UMAX-KI値1",
        "UMAX-KI値2",
        "UMAX-KI値3"
    ];
    // ヘッダー行の定義
    const headers = [
        "日付",
        "会場",
        "レースNo",
        ...resultHeaders,
        "期待フラグ",
        "やらないフラグ",
        "荒れフラグ",
        "1着",
        "２着",
        "３着",
        "配当３連複",
        "指数1",
        "指数2",
        "指数3",
        "指数4",
        "指数5",
        "指数6",
        "指数7",
        "指数8",
        "AI1",
        "AI2",
        "AI3",
        "AI4",
        "AI5",
        "WIN競馬予想1",
        "WIN競馬予想2",
        "WIN競馬予想3",
        "WIN競馬予想4",
        "WIN競馬予想5",
        "WIN競馬予想6",
        "WIN競馬予想7",
        "WIN競馬予想8",
        "JRAVAN1",
        "JRAVAN2",
        "JRAVAN3",
        "JRAVAN4",
        "JRAVAN5",
        "JRAVAN6",
        "CP1",
        "CP2",
        "CP3",
        "CP4",
        "データ分析1",
        "データ分析2",
        "データ分析3",
        "タイム1",
        "タイム2",
        "タイム3",
        "上がり３F1",
        "上がり３F2",
        "上がり３F3",
        "馬場特性1",
        "馬場特性2",
        "馬場特性3",
        "高期待リスト1",
        "高期待リスト2",
        "偏差値1",
        "偏差値2",
        "偏差値3",
        "偏差値4",
        "偏差値5",
        "急上昇1",
        "急上昇2",
        "急上昇3",
        "自己ベスト1",
        "自己ベスト2",
        "自己ベスト3",
        "自己ベスト4",
        "自己ベスト5",
        "人気危険",
        "タイム指数-最高値1",
        "タイム指数-最高値2",
        "タイム指数-最高値3",
        "タイム指数-近走平均1",
        "タイム指数-近走平均2",
        "タイム指数-近走平均3",
        "タイム指数-当該距離1",
        "タイム指数-当該距離2",
        "タイム指数-当該距離3",
        ...umaxPredictionHeaders
    ];
    // TRACK_SORT_ORDERに基づいて競馬場コードでソート
    const sortedAnalysisItems = [...analysisItems].sort((a, b) => {
        return (0, consts_1.compareTrackCode)(a.trackCode, b.trackCode);
    });
    // データ行の作成
    const rows = sortedAnalysisItems.map(item => {
        const row = {
            "日付": `${item.date.substring(0, 4)}/${item.date.substring(4, 6)}/${item.date.substring(6, 8)}`,
            "会場": (0, consts_1.getTrackName)(item.trackCode),
            "レースNo": item.raceNumber,
            "期待フラグ": item.index_expectation,
            "やらないフラグ": "",
            "荒れフラグ": "",
            "1着": "",
            "２着": "",
            "３着": "",
            "配当３連複": "",
        };
        // 指数ランク
        if (item.index_ranks) {
            for (let i = 0; i < item.index_ranks.length; i++) {
                row[`指数${i + 1}`] = item.index_ranks[i];
            }
        }
        // AI指数
        if (item.ai_ranks && item.ai_ranks[0])
            row["AI1"] = item.ai_ranks[0];
        if (item.ai_ranks && item.ai_ranks[1])
            row["AI2"] = item.ai_ranks[1];
        if (item.ai_ranks && item.ai_ranks[2])
            row["AI3"] = item.ai_ranks[2];
        if (item.ai_ranks && item.ai_ranks[3])
            row["AI4"] = item.ai_ranks[3];
        if (item.ai_ranks && item.ai_ranks[4])
            row["AI5"] = item.ai_ranks[4];
        // WIN競馬予想
        if (item.win_prediction_ranks) {
            for (let i = 0; i < item.win_prediction_ranks.length; i++) {
                if (item.win_prediction_ranks[i]) {
                    row[`WIN競馬予想${i + 1}`] = item.win_prediction_ranks[i];
                }
            }
        }
        // JRAVAN予想
        if (item.jravan_prediction_ranks) {
            for (let i = 0; i < item.jravan_prediction_ranks.length; i++) {
                row[`JRAVAN${i + 1}`] = item.jravan_prediction_ranks[i];
            }
        }
        // CP
        if (item.cp_ranks) {
            for (let i = 0; i < item.cp_ranks.length; i++) {
                row[`CP${i + 1}`] = item.cp_ranks[i];
            }
        }
        // データ分析
        if (item.data_analysis_ranks) {
            for (let i = 0; i < item.data_analysis_ranks.length; i++) {
                row[`データ分析${i + 1}`] = item.data_analysis_ranks[i];
            }
        }
        // タイム
        if (item.time_ranks) {
            for (let i = 0; i < item.time_ranks.length; i++) {
                row[`タイム${i + 1}`] = item.time_ranks[i];
            }
        }
        // 上がり3F
        if (item.last_3f_ranks) {
            for (let i = 0; i < item.last_3f_ranks.length; i++) {
                row[`上がり３F${i + 1}`] = item.last_3f_ranks[i];
            }
        }
        // 馬場特性
        if (item.horse_trait_ranks) {
            for (let i = 0; i < item.horse_trait_ranks.length; i++) {
                row[`馬場特性${i + 1}`] = item.horse_trait_ranks[i];
            }
        }
        // 高期待リスト
        if (item.high_expectation_list1 !== undefined)
            row["高期待リスト1"] = item.high_expectation_list1 ? "○" : "";
        if (item.high_expectation_list2 !== undefined)
            row["高期待リスト2"] = item.high_expectation_list2 ? "○" : "";
        // 偏差値
        if (item.deviation_ranks) {
            for (let i = 0; i < Math.min(item.deviation_ranks.length, 5); i++) {
                row[`偏差値${i + 1}`] = item.deviation_ranks[i];
            }
        }
        // 急上昇
        if (item.rapid_rise_ranks) {
            for (let i = 0; i < Math.min(item.rapid_rise_ranks.length, 3); i++) {
                row[`急上昇${i + 1}`] = item.rapid_rise_ranks[i];
            }
        }
        // 自己ベスト
        if (item.personal_best_ranks) {
            for (let i = 0; i < Math.min(item.personal_best_ranks.length, 5); i++) {
                row[`自己ベスト${i + 1}`] = item.personal_best_ranks[i];
            }
        }
        // 人気危険
        if (item.popularity_risk !== undefined && item.popularity_risk !== null) {
            row["人気危険"] = item.popularity_risk;
        }
        // タイム指数-最高値
        if (item.time_index_max_ranks) {
            console.log(`タイム指数-最高値: ${JSON.stringify(item.time_index_max_ranks)}`);
            for (let i = 0; i < Math.min(item.time_index_max_ranks.length, 3); i++) {
                row[`タイム指数-最高値${i + 1}`] = item.time_index_max_ranks[i];
            }
        }
        // タイム指数-近走平均
        if (item.time_index_avg_ranks) {
            console.log(`タイム指数-近走平均: ${JSON.stringify(item.time_index_avg_ranks)}`);
            for (let i = 0; i < Math.min(item.time_index_avg_ranks.length, 3); i++) {
                row[`タイム指数-近走平均${i + 1}`] = item.time_index_avg_ranks[i];
            }
        }
        // タイム指数-当該距離
        if (item.time_index_distance_ranks) {
            console.log(`タイム指数-当該距離: ${JSON.stringify(item.time_index_distance_ranks)}`);
            for (let i = 0; i < Math.min(item.time_index_distance_ranks.length, 3); i++) {
                row[`タイム指数-当該距離${i + 1}`] = item.time_index_distance_ranks[i];
            }
        }
        // レース名
        if (item.raceName) {
            row["レース名"] = item.raceName;
        }
        // コース
        if (item.trackType) {
            row["芝・ダート"] = item.trackType;
        }
        // 距離
        if (item.distance) {
            row["距離"] = `${item.distance}m`;
        }
        // レース結果情報を追加
        if (item.race_result) {
            const result = item.race_result;
            // 着順情報
            if (result.first_place) {
                row["1着"] = result.first_place.horse_number;
                row["1着（人気）"] = result.first_place.popularity;
            }
            if (result.second_place) {
                row["2着"] = result.second_place.horse_number;
                row["2着（人気）"] = result.second_place.popularity;
            }
            if (result.third_place) {
                row["3着"] = result.third_place.horse_number;
                row["3着（人気）"] = result.third_place.popularity;
            }
            // 配当情報
            if (result.win) {
                row["単勝"] = result.win.payout;
            }
            if (result.place && result.place.horses) {
                for (let i = 0; i < Math.min(result.place.horses.length, 3); i++) {
                    row[`複勝${i + 1}`] = result.place.horses[i].payout;
                }
            }
            if (result.quinella) {
                row["馬連"] = result.quinella.payout;
            }
            if (result.trio) {
                row["3連複"] = result.trio.payout;
            }
            if (result.trifecta) {
                row["3連単"] = result.trifecta.payout;
            }
            // UMA-X予想
            if (item.umax_prediction) {
                const umax = item.umax_prediction;
                // 注目馬
                for (let i = 0; i < Math.min(umax.focusedHorseNumbers.length, 5); i++) {
                    row[`UMAX予想${i + 1}`] = umax.focusedHorseNumbers[i];
                }
                // タイム偏差
                for (let i = 0; i < Math.min(umax.timeDeviationTop3.length, 3); i++) {
                    row[`UMAXタイム偏差${i + 1}`] = umax.timeDeviationTop3[i];
                }
                // 上がり偏差
                for (let i = 0; i < Math.min(umax.lastSpurtDeviationTop3.length, 3); i++) {
                    row[`UMAX上がり偏差${i + 1}`] = umax.lastSpurtDeviationTop3[i];
                }
                // SP値
                for (let i = 0; i < Math.min(umax.spValueTop5.length, 5); i++) {
                    row[`UMAX-SP値${i + 1}`] = umax.spValueTop5[i];
                }
                // AG値
                for (let i = 0; i < Math.min(umax.agValueTop5.length, 5); i++) {
                    row[`UMAX-AG値${i + 1}`] = umax.agValueTop5[i];
                }
                // SA値
                for (let i = 0; i < Math.min(umax.saValueTop5.length, 5); i++) {
                    row[`UMAX-SA値${i + 1}`] = umax.saValueTop5[i];
                }
                // KI値
                for (let i = 0; i < Math.min(umax.kiValueTop3.length, 3); i++) {
                    row[`UMAX-KI値${i + 1}`] = umax.kiValueTop3[i];
                }
            }
        }
        return row;
    });
    // Excelワークブックを作成
    const wb = XLSX.utils.book_new();
    // ヘッダーを含むシートを作成
    const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
    // ワークブックにシートを追加
    XLSX.utils.book_append_sheet(wb, ws, '分析データ');
    // ファイルに保存
    const filePath = path_1.default.join(dirPath, filename);
    XLSX.writeFile(wb, filePath);
    console.log(`分析データをExcelファイルに保存しました: ${filePath}`);
}
exports.saveAnalysisToExcel = saveAnalysisToExcel;
