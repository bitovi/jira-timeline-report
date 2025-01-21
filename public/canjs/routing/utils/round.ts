import routeData from "../route-data.js";

import {roundDate} from "../../../utils/date/round.js";


export const roundDateByRoundToParam = {
    start<T extends Date | null | undefined>(date: T) : T extends Date ? Date : T {
        // @ts-ignore
        return date == null ? date : roundDate[routeData.roundTo].start(date)
    },
    end<T extends Date | null | undefined>(date: T) : T extends Date ? Date : T {
        // @ts-ignore
        return date == null ? date : roundDate[routeData.roundTo].end(date)
    }
}