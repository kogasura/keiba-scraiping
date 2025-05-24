import { HorseMarks } from './types';
import { AnalysisData } from './types';

/**
 * WIN競馬予想ランキングを生成する関数
 * @param horseMarks 馬の印情報の配列
 * @returns WIN競馬予想ランキング（上位8頭）
 */
export function generateWinPredictionRanking(horseMarks: HorseMarks[]): {
    win_prediction_ranks?: [number, number, number, number?, number?, number?, number?, number?];
} {
    // 馬の印情報をコピーして並べ替え
    const sortedHorseMarks = [...horseMarks].sort((a, b) => {
        // honmeiRankで比較
        if (a.honmeiRank !== b.honmeiRank) {
            return a.honmeiRank - b.honmeiRank;
        }

        // honmeiRankが同じ場合、taikouRankで比較
        if (a.taikouRank !== b.taikouRank) {
            return a.taikouRank - b.taikouRank;
        }

        // taikouRankも同じ場合、tananaRankで比較
        if (a.tananaRank !== b.tananaRank) {
            return a.tananaRank - b.tananaRank;
        }

        // tananaRankも同じ場合、renkaRankで比較
        if (a.renkaRank !== b.renkaRank) {
            return a.renkaRank - b.renkaRank;
        }

        // renkaRankも同じ場合、honmeiCountで比較
        if (a.honmeiCount !== b.honmeiCount) {
            return b.honmeiCount - a.honmeiCount; // 多い方が上位
        }

        // honmeiCountも同じ場合、taikouCountで比較
        if (a.taikouCount !== b.taikouCount) {
            return b.taikouCount - a.taikouCount; // 多い方が上位
        }

        // taikouCountも同じ場合、tananaCountで比較
        if (a.tananaCount !== b.tananaCount) {
            return b.tananaCount - a.tananaCount; // 多い方が上位
        }

        // tananaCountも同じ場合、renkaCountで比較
        if (a.renkaCount !== b.renkaCount) {
            return b.renkaCount - a.renkaCount; // 多い方が上位
        }

        // すべて同じ場合は同順
        return 0;
    });

    // 上位8頭を抽出
    const top8Horses = sortedHorseMarks.slice(0, 8);

    // 結果オブジェクトを初期化
    const result: {
        win_prediction_ranks?: [number, number, number, number?, number?, number?, number?, number?];
    } = {};

    // 上位8頭の馬番を配列に格納
    const ranks: number[] = top8Horses.map(horse => parseInt(horse.horseNumber, 10));
    
    // 必須の3頭が存在することを確認
    if (ranks.length >= 3) {
        result.win_prediction_ranks = [
            ranks[0], ranks[1], ranks[2],
            ...(ranks.slice(3) as [number?, number?, number?, number?, number?])
        ];
    }

    return result;
}

export function generateTimeRanking(analysisData: AnalysisData): {
    time_ranks?: [number?, number?, number?];
} {
    console.log('generateTimeRanking の引数analysisData:', analysisData);
    // 持ち時計上位順の取得
    const bestTime = analysisData.bestTime;

    // 結果オブジェクトを初期化
    const result: {
        time_ranks?: [number?, number?, number?];
    } = {};

    // 上位3頭の馬番を取得
    const ranks: number[] = bestTime.slice(0, 3).map(horse => parseInt(horse.horseNumber, 10));
    
    // 3頭分のデータが揃っている場合のみ設定
    if (ranks.length > 0) {
        result.time_ranks = [
            ranks[0], 
            ranks.length > 1 ? ranks[1] : undefined, 
            ranks.length > 2 ? ranks[2] : undefined
        ];
    }


    return result;
}

export function generateLast3FRanking(analysisData: AnalysisData): {
    last_3f_ranks?: [number?, number?, number?];
} {
    // 上がり3F上位順の取得
    const last3F = analysisData.last3F;

    // 結果オブジェクトを初期化
    const result: {
        last_3f_ranks?: [number?, number?, number?];
    } = {};

    // 上位3頭の馬番を取得
    const ranks: number[] = last3F.slice(0, 3).map(horse => parseInt(horse.horseNumber, 10));
    
    // データが存在する場合に設定（1〜3頭のケースに対応）
    if (ranks.length > 0) {
        result.last_3f_ranks = [
            ranks[0], 
            ranks.length > 1 ? ranks[1] : undefined, 
            ranks.length > 2 ? ranks[2] : undefined
        ];
    }
    return result;
}

// 馬上特性ランキングを生成する関数。
// 右回りか左回りのデータを取得
export function generateHorseTraitRanking(analysisData: AnalysisData): {
    horse_trait_ranks?: [number, number, number];
} {
    // 右回りか左回りのデータを取得
    // rightHandedTrackが空配列の場合、leftHandedTrackを使用する
    // file_context_0のようなデータでは、rightHandedTrack: []が空配列なので、leftHandedTrackが使われる
    const traitData = analysisData.rightHandedTrack && analysisData.rightHandedTrack.length > 0 
        ? analysisData.rightHandedTrack 
        : analysisData.leftHandedTrack;
    
    // 結果オブジェクトを初期化
    const result: {
        horse_trait_ranks?: [number, number, number];
    } = {};
    
    // traitDataが存在する場合のみ処理
    if (traitData) {
        // 上位3頭の馬番を取得
        const ranks: number[] = traitData.slice(0, 3).map(horse => parseInt(horse.horseNumber, 10));
        
        // 3頭分のデータが揃っている場合のみ設定
        if (ranks.length === 3) {
            result.horse_trait_ranks = [ranks[0], ranks[1], ranks[2]];
        }
    }
    
    return result;
}

