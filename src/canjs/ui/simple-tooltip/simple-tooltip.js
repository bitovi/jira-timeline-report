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

    this.handleResize = this.handleResize.bind(this);
    window.addEventListener("resize", this.handleResize)
  }
  handleResize(){
    if(this._resizeFunction) {
      this[this._resizeFunction]();
    }
  }
  disconnectedCallback(){
    if(this._forElement) {
      this._forElement.removeEventListener("mouseenter", this.enteredElement);
      this._forElement.removeEventListener("mouseenter", this.leftElement);
    }
    window.removeEventListener("resize", this.handleResize)
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
    if(typeof DOM === "string") {
      this.innerHTML = DOM;
    } else {
      this.appendChild(DOM);
    }
    this.style.display = "";
    // HACKY AF
    this._relativeElement = element;
    this._resizeFunction = "resize_belowElementInScrollingContainer";
    this.handleResize();
  }
  resize_belowElementInScrollingContainer() {
    const container = this.parentNode;
    const element = this._relativeElement;

    // where is the container on the page
    const containerRect = container.getBoundingClientRect(),
      // where is the element we are positioning next to on the page
      elementRect = element.getBoundingClientRect(),
      // how big is the tooltip
      tooltipRect = this.getBoundingClientRect();
    
    const containerStyles = window.getComputedStyle(container)
    // how much room is there 
    
    // where would the tooltip's bottom reach in the viewport 
    const howMuchPastTheBottom = elementRect.bottom + tooltipRect.height - window.innerHeight;
    const howMuchAboveTheTop = elementRect.top - tooltipRect.height;

    const scrollingAdjustment = container === document.documentElement ? 0 : container.scrollTop;

    // if the tooltip wouldn't be visible "down" 
    if(howMuchPastTheBottom <= 0 || howMuchAboveTheTop < 0) {
      const topFromContainer = elementRect.bottom - containerRect.top -  parseFloat( containerStyles.borderTopWidth, 10);
      this.style.top = (topFromContainer + scrollingAdjustment) +"px";
    } else {
      const viewPortPosition = ( elementRect.top - tooltipRect.height );
      const posInContainer = viewPortPosition - containerRect.top -  parseFloat( containerStyles.borderTopWidth, 10);
      const posInContainerAccountingForScrolling = posInContainer + scrollingAdjustment;
      this.style.top = ( posInContainerAccountingForScrolling )+"px";
    }
    
    let leftFromContainer = elementRect.left - containerRect.left;
    // if the element would go past the page to the right
    if(elementRect.left  + tooltipRect.width > window.innerWidth) {
      //leftFromContainer = elementRect.right - containerRect.left - tooltipRect.width;
      this.style.right = (containerRect.right - elementRect.right) + "px";
      this.style.left = "";
    } else {
      this.style.left = leftFromContainer +"px";
    }
    
  }
  rightOfElementInScrollingContainer(element, DOM) {
    // find if there's a scrolling container and move ourselves to that 
    const container = findScrollingContainer(element);
    this.innerHTML = "";
    container.appendChild(this);
    // find the relative position 
    this.style.top = "-1000px";
    this.style.left = "-1000px";
    if(typeof DOM === "string") {
      this.innerHTML = DOM;
    } else {
      this.appendChild(DOM);
    }
    this.style.display = "";
    
    // where is the container on the page
    const containerRect = container.getBoundingClientRect(),
      // where is the element we are positioning next to on the page
      elementRect = element.getBoundingClientRect(),
      // how big is the tooltip
      tooltipRect = this.getBoundingClientRect();
    
    const containerStyles = window.getComputedStyle(container)
    // how much room is there 
    
    // where would the tooltip's bottom reach in the viewport 
    const bottomInWindow = elementRect.top + tooltipRect.height;

    const scrollingAdjustment = container === document.documentElement ? 0 : container.scrollTop;

    // if the tooltip wouldn't be visible "down" 
    /*if(bottomInWindow > window.innerHeight) {
      const viewPortPosition = ( elementRect.top - tooltipRect.height );
      const posInContainer = viewPortPosition - containerRect.top -  parseFloat( containerStyles.borderTopWidth, 10);
      const posInContainerAccountingForScrolling = posInContainer + scrollingAdjustment;
      this.style.top = ( posInContainerAccountingForScrolling )+"px";
    } else {*/
      const topFromContainer = elementRect.top - containerRect.top -  parseFloat( containerStyles.borderTopWidth, 10);
      this.style.top = (topFromContainer + scrollingAdjustment) +"px";
    //}

    const leftFromContainer = elementRect.right - containerRect.left;
    this.style.left = (leftFromContainer )+"px";
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