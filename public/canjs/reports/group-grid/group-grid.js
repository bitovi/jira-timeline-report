
import { StacheElement, type, ObservableObject, stache } from "../../../can.js";

const DAY = 1000*60*60*24;
export class GroupGrid extends StacheElement {
    static view = `
        Hello World
    `;
}

customElements.define("group-grid",GroupGrid);