import { StacheElement, type, ObservableObject, ObservableArray } from "./can.js";
import {updateUrlParam} from "./shared/state-storage.js";
import "./shared/autocomplete/autocomplete.js";

export class StatusFilter extends StacheElement {
    static view = `
    <auto-complete 
        data:from="this.statuses" 
        selected:bind="this.selectedStatuses"
        inputPlaceholder:raw="Search for statuses"></auto-complete>
    
    `;
    static props = {
        statuses: {
            get default(){
                return [];
            }
        },
        param: String,
        selectedStatuses: {
            value({resolve, lastSet, listenTo}){
                const updateValue = (value) => {
                    if(!value) {
                        value = "";
                    } else if( Array.isArray(value) ){
                        value = value.join(",")
                    }
                    updateUrlParam(this.param, value, "");

                    currentValue = value === "" ? [] : value.split(",");
                    resolve(currentValue);
                }
                let currentValue;
                updateValue(new URL(window.location).searchParams.get(this.param));

                listenTo(lastSet, (value)=>{
                    updateValue(value);
                });

                
            }
        }
    };
}

customElements.define("status-filter",StatusFilter);