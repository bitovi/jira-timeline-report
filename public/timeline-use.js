import showdown from "./showdown.js"


const POLL = true;


class TimelineUse extends HTMLElement {
  connectedCallback(){
		this.update();

		this.converter = new showdown.Converter({tables: true});

		if(POLL) {
			setInterval( this.update.bind(this), 3000);
		}
	}
	update(){
		fetch("./timeline-use.md").then( r=> r.text()).then( (text)=> {
			this.innerHTML = this.converter.makeHtml(text);
		})
	}
}


customElements.define("timeline-use", TimelineUse);
