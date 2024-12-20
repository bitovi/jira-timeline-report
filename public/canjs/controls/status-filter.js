import { StacheElement, type, ObservableObject, ObservableArray } from "../../can.js";
import "../ui/autocomplete/autocomplete.js";

export class StatusFilter extends StacheElement {
    static view = `
    <auto-complete 
        data:from="this.statuses" 
        selected:bind="this.selectedStatuses"
        inputPlaceholder:from="this.inputPlaceholder"></auto-complete>
    
    `;
    static props = {
        statuses: {
            get default(){
                return [];
            }
        },
        inputPlaceholder: String,
        param: String,
        selectedStatuses: undefined
    };
}

customElements.define("status-filter",StatusFilter);