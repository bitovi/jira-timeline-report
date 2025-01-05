import {ObservableObject} from "../../can";
import {saveJSONToUrl} from "./state-storage.js";


import { DAY_IN_MS } from "../../utils/date/date-helpers.js";


const _15DAYS_IN_S = DAY_IN_MS / 1000 * 15;

class RouteData extends ObservableObject {
    static props = {
        compareTo: saveJSONToUrl("compareTo", _15DAYS_IN_S, Number, {
            parse(string){
                if(/^\d+$/.test(string)) {
                    return Number(string);
                } 
                else {
                    return _15DAYS_IN_S;
                }
            },
            stringify(number){
                return ""+number;
            }
        }),
    }
}


export default new RouteData();