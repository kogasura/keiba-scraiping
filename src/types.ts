export interface RaceInfo {
    // 上記三つはWinkeibaなどの他の媒体とデータを合わすため。
    date: string; // 日付
    trackCode: string; // 競馬場コード
    raceNumber: number; // レース番号
    race_name: string;
    course: string;
    venue: string;
    start_time: string;
    track_type: '芝' | 'ダート' | '障害';
    distance: number;
    entries_count: number;
    weather: string;
    track_condition: string;
    prize_money: number;
    netkeiba_race_id: number;
    winkeiba_race_info?: WinkeibaRaceInfo;
    is_finished: boolean;
    entries?: HorseEntry[]; // レースに参加する馬のリスト
    analysis?: AnalysisItem[]; // 分析結果
    created_at?: string; // 作成日時
    updated_at?: string; // 更新日時
}

export interface WinkeibaRaceInfo {
    RaceNum: string; // 何レース目？ 01
    RacetrackCd: string; //競馬場コード 06
    DOR: string; //日付　20250330
}

export interface AnalysisItem {
    date: string; // 日付
    trackCode: string; // 競馬場コード
    raceNumber: number; // レース番号
    netkeiba_race_id?: number; // netkeibaのレースID
    raceName?: string; // レース名
    trackType?: string; // コース 芝、ダート
    distance?: number; // 距離
    race_result?: RaceResult; // レース結果
    umax_prediction?: UmaxRacePrediction; // UMAXの予想
    index_ranks?: [number, number, number, number, number, number, number, number]; // 指数1-8
    index_expectation?: string; // 指数期待度の情報 A,B,C,D,E,F、指数1~8と同様にnoteの画像から読み取る
    ai_ranks?: [number?, number?, number?, number?, number?]; // note画像から取得する AI指数1-5
    win_prediction_ranks?: [number, number, number, number?, number?, number?, number?, number?]; // WIN競馬予想1-8（1-3は必須、4-8はオプション。なぜなら色を基準に判断する際に、1-3は必ず存在するため）
    jravan_prediction_ranks?: [number, number, number, number, number, number]; // JRAVAN予想1-6
    cp_ranks?: [number,number,number,number]; // CP1,CP2,CP3,CP4
    data_analysis_ranks?: [number,number,number]; // データ分析1,データ分析2,データ分析3
    time_ranks?: [number?,number?,number?]; // タイム1,タイム2,タイム3
    last_3f_ranks?: [number?,number?,number?]; // 上がり3F 1,上がり3F 2,上がり3F 3
    horse_trait_ranks?: [number,number,number]; // 馬上特性1,馬上特性2,馬上特性3
    high_expectation_list1?: boolean; // 高期待リスト1
    high_expectation_list2?: boolean; // 高期待リスト2
    deviation_ranks?: number[]; // 偏差値（0～5頭）
    rapid_rise_ranks?: number[]; // 急上昇（0～3頭）
    personal_best_ranks?: number[]; // 自己ベスト（0～5頭）
    popularity_risk?: number | null; // 人気危険
    time_index_max_ranks?: [number, number, number, number, number]; // タイム指数-最高値1,タイム指数-最高値2,タイム指数-最高値3,タイム指数-最高値4,タイム指数-最高値5
    time_index_avg_ranks?: [number, number, number, number, number]; // タイム指数-近走平均1,タイム指数-近走平均2,タイム指数-近走平均3,タイム指数-近走平均4,タイム指数-近走平均5
    time_index_distance_ranks?: [number, number, number, number, number]; // タイム指数-当該距離1,タイム指数-当該距離2,タイム指数-当該距離3,タイム指数-当該距離4,タイム指数-当該距離5
    created_at?: string; // 作成日時
    updated_at?: string; // 更新日時
}

export interface AnalysisData {
    date: string;
    trackCode: string;
    raceNumber: string;
    bestTime: {
        horseNumber: string;
        horseName: string;
        rank: number;
    }[];
    last3F: {
        horseNumber: string;
        horseName: string;
        rank: number;
    }[];
    rightHandedTrack?: {
        horseNumber: string;
        horseName: string;
        rank: number;
    }[];
    leftHandedTrack?: {
        horseNumber: string;
        horseName: string;
        rank: number;
    }[];
}

export interface HorseEntry {
    horse_number: number; // 馬番
    frame_number: number; // 枠番
    horse_name: string; // 馬名
    jockey: string; // 騎手
    weight_carried: number; // 斤量
    popularity?: number; // 人気
    odds?: number; // オッズ（少数第一位まで）
    trainer: string; // 調教師
    sex_age: string; // 性齢
    weight?: number; // 馬体重
    result_position?: number; // 着順
    result_time?: number; // タイム（秒）
    margin?: string; // 着差（馬身）
    remarks?: string; // 備考
    netkeiba_horse_id: string; // netkeibaの馬ID
    created_at?: string; // 作成日時
    updated_at?: string; // 更新日時
}

// netkeibaのタイム指数用のインターフェース
export interface TimeIndex {
  netkeiba_race_id: number;
  time_index_horse_numbers: [number, number, number, number, number]; // 上位5頭の馬番
}

// netkeibaのデータ分析、調子偏差値用のインターフェース
export interface NetkeibaDataAnalysis {
  netkeiba_race_id: number;// netkeibaのレースID
  deviation_ranks: number[]; // 偏差値上位5頭まで
  rapid_rise_ranks: number[]; // 急上昇上位5頭まで
  personal_best_ranks: number[]; // 自己ベスト上位5頭まで
  popularity_risk: number | null; // 人気危険
}

// netkeibaのデータ分析、データ分析用のインターフェース
export interface NetkeibaDataAnalysisSimple {
  netkeiba_race_id: number;// netkeibaのレースID
  data_analysis_ranks?: [number,number,number]; // データ分析1-3
}

export interface NetkeibaCPPrediction {
  netkeiba_race_id: number;// netkeibaのレースID
  cp_ranks: [number,number,number,number]; // CP1-4
}

export interface HorseMarkArray {
    date: string;
    trackCode: string;
    raceNumber: string;
    marks: HorseMarks[];
}

export interface HorseMarks {
    horseNumber: string;
    frameNumber: string;  // 枠番を追加
    horseName: string;
    horseId: string;
    honmeiCount: number;  // ◎
    honmeiRank: number;
    taikouCount: number;  // ○
    taikouRank: number;
    tananaCount: number;  // ▲
    tananaRank: number;
    renkaCount: number;   // △
    renkaRank: number;
    otherCount: number;   // その他
    otherRank: number;
    odds: number;
    popularity: number;
}

export interface NoteImageOCRResponse {
    index_expectation?: string; // 指数期待度の情報 A,B,C,D,E,F
    raceNumber: number; // レース番号
    horses: {
        number: number; // 馬番
        name: string; // 馬名
        rank: number; // 順位
        score: number; // 得点
    }[];
}

// 競馬の結果を格納するためのインターフェース
export interface RaceResult {
  date: string;                // レース日付
  trackCode: string;           // トラックコード
  raceNumber: string;          // レース番号
  // 着順情報
  first_place: {
    horse_number: number;      // 馬番
    horse_name: string;        // 馬名
    popularity: number;        // 人気
  };
  second_place: {
    horse_number: number;      // 馬番
    horse_name: string;        // 馬名
    popularity: number;        // 人気
  };
  third_place: {
    horse_number: number;      // 馬番
    horse_name: string;        // 馬名
    popularity: number;        // 人気
  };
  // 配当情報
  win: {                       // 単勝
    horse_number: number;      // 馬番
    popularity: number;        // 人気順
    payout: number;            // 払戻金額
  };
  place: {                     // 複勝
    horses: [
      {
        horse_number: number;  // 馬番
        popularity: number;    // 人気順
        payout: number;        // 払戻金額
      },
      {
        horse_number: number;  // 馬番
        popularity: number;    // 人気順
        payout: number;        // 払戻金額
      },
      {
        horse_number: number;  // 馬番
        popularity: number;    // 人気順
        payout: number;        // 払戻金額
      }
    ]
  };
  bracket_quinella: {          // 枠連
    combination: string;       // 組み合わせ
    popularity: number;        // 人気順
    payout: number;            // 払戻金額
  };
  quinella: {                  // 馬連
    combination: string;       // 組み合わせ
    popularity: number;        // 人気順
    payout: number;            // 払戻金額
  };
  quinella_place: {            // ワイド
    combinations: string[];    // 組み合わせリスト
    popularity: number[];      // 人気順リスト
    payouts: number[];         // 払戻金額リスト
  };
  exacta: {                    // 馬単
    combination: string;       // 組み合わせ
    popularity: number;        // 人気順
    payout: number;            // 払戻金額
  };
  trio: {                      // 三連複
    combination: string;       // 組み合わせ
    popularity: number;        // 人気順
    payout: number;            // 払戻金額
  };
  trifecta: {                  // 三連単
    combination: string;       // 組み合わせ
    popularity: number;        // 人気順
    payout: number;            // 払戻金額
  };
}

export interface RaceDetail {
    // ... 既存のプロパティ ...
    horseMarks?: HorseMarks[];
} 

// noteの画像からOCRしたデータを格納するためのインターフェース

export interface NoteAI {
    date: string;
    trackCode: string;
    raceNumber: string;
    ai_ranks: [number?, number?, number?, number?, number?]; // note画像から取得する AI指数1-5
}

export interface UmaxRacePrediction {
  date: string;
  trackCode: string;
  raceNumber: string;
  focusedHorseNumbers: number[]; // 注目馬5頭の馬番号を格納する配列
  timeDeviationTop3: number[]; // タイム偏差上位3頭の馬番号
  lastSpurtDeviationTop3: number[]; // 上がり偏差上位3頭の馬番号
  spValueTop5: number[]; // SP値上位5頭の馬番号
  agValueTop5: number[]; // AG値上位5頭の馬番号
  saValueTop5: number[]; // SA値上位5頭の馬番号
  kiValueTop3: number[]; // KI値上位3頭の馬番号
}