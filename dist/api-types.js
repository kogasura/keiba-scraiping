"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchJobStatus = exports.BatchJobType = void 0;
// バッチジョブの種類
var BatchJobType;
(function (BatchJobType) {
    BatchJobType["RACE_INFO"] = "race_info";
    BatchJobType["RACE_RESULT"] = "race_result";
    BatchJobType["PREDICTION"] = "prediction";
    BatchJobType["INDEX"] = "index";
    BatchJobType["AI_INDEX"] = "ai_index";
})(BatchJobType = exports.BatchJobType || (exports.BatchJobType = {}));
// バッチジョブのステータス
var BatchJobStatus;
(function (BatchJobStatus) {
    BatchJobStatus["QUEUED"] = "queued";
    BatchJobStatus["PROCESSING"] = "processing";
    BatchJobStatus["COMPLETED"] = "completed";
    BatchJobStatus["FAILED"] = "failed";
})(BatchJobStatus = exports.BatchJobStatus || (exports.BatchJobStatus = {}));
