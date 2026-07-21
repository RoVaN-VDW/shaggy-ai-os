export type EntityEvent = {
  type: "BOOT_COMPLETE" | "VAD_START" | "VAD_END" | "TTS_START" | "TTS_END" | "FAULT" | "BARGE_IN" | "MIC_PERMISSION_ERROR" | "RESULT_SUCCESS" | "RESULT_WARNING" | "RESULT_ERROR" | "RECOVER" | "TICK";
  epoch: number;
  at: number;
};
