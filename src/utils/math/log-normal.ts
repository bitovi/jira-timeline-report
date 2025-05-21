import { jStat } from "jstat";
export function logNormalStats(values: number[]) {
    const logValues = values.map(Math.log);
    const meanLog = jStat.mean(logValues);
    const stdDevLog = jStat.stdev(logValues, true);
    const varianceLog = stdDevLog ** 2;
  
    const median = Math.exp(meanLog);
    const mean = Math.exp(meanLog + varianceLog / 2);
    const variance = (Math.exp(varianceLog) - 1) * Math.exp(2 * meanLog + varianceLog);
  
    return {
      meanLog,
      stdDevLog,
      varianceLog,
      median,
      mean,
      variance
    };
  }