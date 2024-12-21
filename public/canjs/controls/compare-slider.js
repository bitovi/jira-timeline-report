import {StacheElement} from "../../can";

import routeData from "../routing/route-data.js";

import {createLinearMapping, createInverseMapping} from "../../utils/math/linear-mapping";
import {DROPDOWN_LABEL} from "../../shared/style-strings";


const MINUTE_IN_S = 60;
const HOUR_IN_S = MINUTE_IN_S*60;
const DAY_IN_S = 24 * HOUR_IN_S;

const MAPPING_POINTS = [
  [0,0],
  [2,60],
  [3,5*MINUTE_IN_S],
  [4,10*MINUTE_IN_S],
  [5,30*MINUTE_IN_S],
  [6, HOUR_IN_S],
  [7, 3*HOUR_IN_S],
  [8, 6*HOUR_IN_S],
  [9, 12*HOUR_IN_S],
  [10, DAY_IN_S],
  [69, 60*DAY_IN_S],
  [100, 365*DAY_IN_S]
];


const valueToSeconds = createLinearMapping(MAPPING_POINTS),
    secondsToValue = createInverseMapping(MAPPING_POINTS);


export class ComapreSlider extends StacheElement {
    static view = `
        <label for="compareValue" class="${DROPDOWN_LABEL}">Compare to {{this.compareToTime.text}}</label>
        <input class="w-full-border-box h-8" 
            id="compareValue"
            type='range' 
            valueAsNumber:bind:on:input='this.timeSliderValue' 
            min="0" max="100"/>
    `;
    static props = {
        routeData: {
            get default(){ return routeData; }
        },
        timeSliderValue: {
            get(){
                const compareTo = this.routeData.compareTo;
                const value = secondsToValue(compareTo);
                return 100-Math.round(value);
            },
            set(value){
                const seconds = valueToSeconds(100 - value);
                this.routeData.compareTo = Math.round(seconds);
            }
        },
        get compareToTime() {
            const compareTo = this.routeData.compareTo;

            const SECOND = 1000;
            const MIN = 60 * SECOND;
            const HOUR = 60 * MIN;
            const DAY = 24 * HOUR;

            if (compareTo === 0) {
              return { timePrior: 0, text: "now" };
            }
            else if(compareTo < MINUTE_IN_S) {
                return { timePrior: compareTo * SECOND, text: compareTo+" seconds ago" };
            }
            else if(compareTo < HOUR_IN_S) {
                return { timePrior: compareTo * SECOND, text: Math.round(compareTo / MINUTE_IN_S)+" minutes ago" };
            }
            else if(compareTo < DAY_IN_S) {
                return { timePrior: compareTo * SECOND, text: Math.round(compareTo / HOUR_IN_S)+" hours ago" };
            }
            else {
                return { timePrior: compareTo * SECOND, text: Math.round(compareTo / DAY_IN_S)+" days ago" };
            }
        }
    }
      
}

customElements.define("compare-slider", ComapreSlider);