const axios = require('axios');

// テスト用の予想データ
const testPredictionsData = {
  date: "2025-07-19",
  trackCode: "02",
  predictions: [
    {
      raceNumber: 1,
      win_prediction_ranks: [1, 2, 3, 4, 5],
      jravan_prediction_ranks: [1, 2, 3, 4, 5, 6],
      cp_ranks: [1, 2, 3, 4],
      data_analysis_ranks: [1, 2, 3],
      time_ranks: [1, 2, 3],
      last_3f_ranks: [1, 2, 3],
      horse_trait_ranks: [1, 2, 3],
      deviation_ranks: [1, 2, 3],
      rapid_rise_ranks: [1, 2],
      personal_best_ranks: [1, 2, 3],
      popularity_risk: 1,
      time_index_max_ranks: [1, 2, 3, 4, 5],
      time_index_avg_ranks: [1, 2, 3, 4, 5],
      time_index_distance_ranks: [1, 2, 3, 4, 5],
      umax_ranks: [1, 2, 3, 4, 5],
      umax_sp_values: [85, 82, 79, 76, 73],
      umax_ag_values: [88, 85, 82, 79, 76],
      umax_sa_values: [90, 87, 84, 81, 78],
      umax_ki_values: [92, 89, 86, 83, 80]
    },
    {
      raceNumber: 2,
      win_prediction_ranks: [2, 4, 6, 8, 10],
      jravan_prediction_ranks: [2, 4, 6, 8, 10, 12],
      cp_ranks: [2, 4, 6, 8],
      data_analysis_ranks: [2, 4, 6],
      time_ranks: [2, 4, 6],
      last_3f_ranks: [2, 4, 6],
      horse_trait_ranks: [2, 4, 6],
      deviation_ranks: [2, 4, 6],
      rapid_rise_ranks: [2, 4],
      personal_best_ranks: null,
      popularity_risk: null,
      time_index_max_ranks: [2, 4, 6, 8, 10],
      time_index_avg_ranks: [2, 4, 6, 8, 10],
      time_index_distance_ranks: [2, 4, 6, 8, 10],
      umax_ranks: [2, 4, 6, 8, null],
      umax_sp_values: [80, 77, 74, 71, null],
      umax_ag_values: [83, 80, 77, 74, null],
      umax_sa_values: [85, 82, 79, 76, null],
      umax_ki_values: [87, 84, 81, 78, null]
    }
  ]
};

async function testPredictionsAPI() {
  try {
    const response = await axios.post('http://localhost/api/v1/predictions', testPredictionsData, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': 'testkey'
      },
      timeout: 300000
    });

    console.log('Response Status:', response.status);
    console.log('Response Body:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    if (error.response) {
      console.error('API Error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('Network Error:', error.message);
      console.log('サーバーが起動していない可能性があります');
    } else {
      console.error('Error:', error.message);
    }
  }
}

// データの妥当性チェック
console.log('送信データ:');
console.log(JSON.stringify(testPredictionsData, null, 2));
console.log('\n---\n');

testPredictionsAPI();