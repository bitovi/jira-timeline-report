import { StacheElement, type, ObservableObject, ObservableArray } from "./can.js";
import {updateUrlParam} from "./shared/state-storage.js";
import "./shared/autocomplete/autocomplete.js";

export class StatusFilter extends StacheElement {
    static view = `
    <auto-complete 
        data:from="this.statuses" 
        selected:bind="this.statusesToRemove"
        inputPlaceholder:raw="Search for statuses"></auto-complete>
    
    `;
    static props = {
        statuses: {
            get default(){
                return [];
            }
        },
        statusesToRemove: {
            value({resolve, lastSet, listenTo}){

                let currentValue;
                updateValue(new URL(window.location).searchParams.get("statusesToRemove"));

                listenTo(lastSet, (value)=>{
                    updateValue(value);
                });

                function updateValue(value) {
                    if(!value) {
                        value = "";
                    } else if( Array.isArray(value) ){
                        value = value.join(",")
                    }
                    updateUrlParam("statusesToRemove", value, "");

                    currentValue = value === "" ? [] : value.split(",");
                    resolve(currentValue);
                }
            }
        }
    };
}

customElements.define("status-filter",StatusFilter);