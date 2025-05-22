import { StacheElement } from "../../can";

import routeData from "../routing/route-data";

import { createLinearMapping, createInverseMapping } from "../../utils/math/linear-mapping";
import { DROPDOWN_LABEL } from "../../shared/style-strings";

const MINUTE_IN_S = 60;
const HOUR_IN_S = MINUTE_IN_S * 60;
const DAY_IN_S = 24 * HOUR_IN_S;

const SECOND = 1000;
const MIN = 60 * SECOND;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const MAPPING_POINTS = [
  [0, 0],
  [2, 60],
  [3, 5 * MINUTE_IN_S],
  [4, 10 * MINUTE_IN_S],
  [5, 30 * MINUTE_IN_S],
  [6, HOUR_IN_S],
  [7, 3 * HOUR_IN_S],
  [8, 6 * HOUR_IN_S],
  [9, 12 * HOUR_IN_S],
  [10, DAY_IN_S],
  [69, 60 * DAY_IN_S],
  [100, 365 * DAY_IN_S],
];

const dateFormatter = new Intl.DateTimeFormat(navigator.language).format(new Date());

const valueToSeconds = createLinearMapping(MAPPING_POINTS),
  secondsToValue = createInverseMapping(MAPPING_POINTS);

/*
@Deprecated - Use the CompareSlider in react instead. This file will be deleted.
*/
export class ComapreSlider extends StacheElement {
  static view = `
        <div class="flex justify-between text-neutral-801 text-xs">
            <div>
                Compare to 
                <input type="date" 
                    class="rounded bg-neutral-201 py-1 px-2 leading-3 hover:bg-neutral-301 cursor-pointer {{this.dateSelectedClassName}}" 
                    value:from="this.isoString"
                    on:input="this.updateRouteData(scope.element.value)"/>
            </div>
            <label for="compareValue" class="pt-1">
                <span class="{{this.timeAgoClassName}}">{{this.compareToTime.timeText}}</span> 
                {{this.compareToTime.unitText}}</label>
        </div>
        
        <input class="w-full-border-box h-8" 
            id="compareValue"
            type='range' 
            valueAsNumber:bind:on:input='this.timeSliderValue' 
            min="0" max="100"/>
    `;
  static props = {
    routeData: {
      get default() {
        return routeData;
      },
    },
    timeSliderValue: {
      get() {
        const compareTo = this.routeData.compareTo;
        const value = secondsToValue(compareTo);
        return 100 - Math.round(value);
      },
      set(value) {
        const seconds = valueToSeconds(100 - value);
        this.routeData.compareTo = Math.round(seconds);
      },
    },
    get compareToTime() {
      const compareTo = this.routeData.compareTo;
      let timeText, unitText;

      if (compareTo === 0) {
        timeText = "now";
        unitText = "";
      } else if (compareTo < MINUTE_IN_S) {
        timeText = "" + compareTo;
        unitText = "seconds ago";
      } else if (compareTo < HOUR_IN_S) {
        timeText = Math.round(compareTo / MINUTE_IN_S);
        unitText = " minutes ago";
      } else if (compareTo < DAY_IN_S) {
        timeText = Math.round(compareTo / HOUR_IN_S);
        unitText = " hours ago";
      } else if (compareTo == DAY_IN_S) {
        timeText = Math.round(compareTo / DAY_IN_S);
        unitText = " day ago";
      } else {
        timeText = Math.round(compareTo / DAY_IN_S);
        unitText = " days ago";
      }

      return {
        timePrior: compareTo * SECOND,
        timeText,
        unitText,
      };
    },
    get isoString() {
      const compareTo = this.routeData.compareTo;
      if (compareTo < DAY_IN_S) {
        return getDateDaysAgoLocal(0);
      } else {
        const daysAgo = Math.round(compareTo / DAY_IN_S);
        return getDateDaysAgoLocal(daysAgo);
      }
    },
    get dateSelectedClassName() {
      if (this.routeData.compareToType === "date") {
        return " font-semibold ";
      }
    },
    get timeAgoClassName() {
      if (this.routeData.compareToType === "seconds") {
        return " font-semibold ";
      }
    },
  };
  updateRouteData(isoDate) {
    this.routeData.compareTo = isoDate;
  }
}

function getDateDaysAgoLocal(daysAgo) {
  const now = new Date(); // Current date and time in the user's local timezone

  // Create a new date object representing 'daysAgo' days before today
  const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);

  // Format the date as ISO 8601 (yyyy-mm-dd)
  return localDate.toISOString().split("T")[0];
}

customElements.define("compare-slider", ComapreSlider);
