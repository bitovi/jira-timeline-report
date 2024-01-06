class SimpleTooltip extends HTMLElement {
  static get observedAttributes() { return ['for']; }
  attributeChangedCallback(name, oldValue, newValue) {

  }
  connectedCallback(){
    this.enteredElement = this.enteredElement.bind(this);
    this.leftElement = this.leftElement.bind(this);
    this.forElement = this.getAttribute("for");
    this.style.display = "none";

    this.style.position = "absolute";
  }
  disconnectedCallback(){
    if(this._forElement) {
      this._forElement.removeEventListener("mouseenter", this.enteredElement);
      this._forElement.removeEventListener("mouseenter", this.leftElement);
    }
  }
  set forElement(element){
    if(typeof element === "string") {
      element = document.querySelectorAll(element);
    }
    if(this._forElement) {
      this._forElement.removeEventListener("mouseenter", this.enteredElement);
      this._forElement.removeEventListener("mouseenter", this.leftElement);
    }
    if(element) {
      element.addEventListener("mouseenter", this.enteredElement);
      element.addEventListener("mouseenter", this.leftElement);
    }
    this._forElement = element;
  }
  enteredElement(event, html){
    if(arguments.length > 1) {
      this.innerHTML = html;
      var rect = event.currentTarget.getBoundingClientRect();
      this.style.top = (window.scrollY + rect.bottom)+"px";
      this.style.left = (window.scrollX + rect.left) +"px";
      this.style.display = "";
    }
  }
  belowElement(element, DOM) {
      if(arguments.length > 1) {
          this.innerHTML = "";
          this.appendChild(DOM);

          this.style.top = "-1000px";
          this.style.left = "-1000px";
          this.style.display = "";

          const height = this.clientHeight;
          var rect = element.getBoundingClientRect();
          const top = (window.scrollY + rect.bottom);
          const bottom = top + height;
          console.log(height, bottom, window.innerHeight,rect.top - height);
          if(bottom >= window.innerHeight) {
            this.style.top = (rect.top - height)+"px";
          } else {
            this.style.top = top+"px";
            
          }
          this.style.left = (window.scrollX + rect.left) +"px";
          
      }
  }
  belowElementInScrollingContainer(element, DOM){
    // find if there's a scrolling container and move ourselves to that 
    const container = findScrollingContainer(element);
    this.innerHTML = "";
    container.appendChild(this);
    // find the relative position 
    this.style.top = "-1000px";
    this.style.left = "-1000px";
    this.appendChild(DOM);
    this.style.display = "";
    
    
    const containerRect = container.getBoundingClientRect(),
      elementRect = element.getBoundingClientRect(),
      tooltipRect = this.getBoundingClientRect();
    
    const topFromContainer = elementRect.bottom - containerRect.top;
    const leftFromContainer = elementRect.left - containerRect.left;
    const bottomInWindow = elementRect.bottom + tooltipRect.height;

    if(bottomInWindow > window.innerHeight) {
      this.style.top = (( elementRect.top - tooltipRect.height ) - containerRect.top )+"px";
    } else {
      this.style.top = topFromContainer +"px";
    }

   
    this.style.left = leftFromContainer +"px";
    
  }
  centeredBelowElement(element, html) {
    if(arguments.length > 1) {
      this.style.top = "-1000px";
      this.style.left = "-1000px";
      
      this.innerHTML = html;
      
      this.style.display = "";
      const tooltipRect = this.getBoundingClientRect();

      var rect = element.getBoundingClientRect();
      this.style.top = (window.scrollY + rect.bottom)+"px";
      this.style.left = (window.scrollX + rect.left + (rect.width / 2) - (tooltipRect.width / 2)) +"px";
    }
  }
  topRightOnElementBottomRight(element, html) {
    if(arguments.length > 1) {
      this.style.top = "-1000px";
      this.style.left = "-1000px";

      if(typeof html === "string") {
        this.innerHTML = html;
      } else {
        this.innerHTML = "";
        this.appendChild(html);
      }
      
      
      this.style.display = "";

      const tooltipRect = this.getBoundingClientRect();
      const rect = element.getBoundingClientRect();

      this.style.top = (window.scrollY + rect.bottom)+"px";
      this.style.left = (window.scrollX + rect.left + (rect.width) - (tooltipRect.width)) +"px";
    }
  }
  leftElement(event) {
    this.style.display = "none";
  }
}
customElements.define("simple-tooltip", SimpleTooltip);
export default SimpleTooltip;



function findScrollingContainer(element){
  let cur = element.parentElement;
  while(cur && cur.scrollHeight === cur.clientHeight) {
    cur = cur.parentElement;
  }
  if(!cur) {
    return document.body
  } else {
    return cur;
  }
}