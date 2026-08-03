# CanJS Components Style Guide

## Overview

CanJS components in this codebase follow established CanJS patterns with distinctive customizations for data visualization, tooltip management, and React integration. These components primarily handle reports, controls, UI widgets, and routing logic.

## Unique Conventions

### 1. StacheElement Class-Based Components

All CanJS components extend `StacheElement` with static view and props definitions:

```javascript
export class StatusFilter extends StacheElement {
  static view = `
    <auto-complete 
        data:from="this.statuses" 
        selected:bind="this.selectedStatuses"
        inputPlaceholder:from="this.inputPlaceholder"></auto-complete>
  `;
  static props = {
    statuses: {
      get default() {
        return [];
      },
    },
    inputPlaceholder: String,
    param: String,
    selectedStatuses: {
      get default() {
        return [];
      },
    },
  };
}

customElements.define('status-filter', StatusFilter);
```

**Pattern**: Class export followed by immediate custom element registration with kebab-case names.

### 2. Custom HTMLElement Base Classes

Some components use plain HTMLElement for lower-level control:

```javascript
class SimpleTooltip extends HTMLElement {
  static get observedAttributes() {
    return ['for'];
  }

  connectedCallback() {
    this.enteredElement = this.enteredElement.bind(this);
    this.leftElement = this.leftElement.bind(this);
    this.style.position = 'absolute';
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
  }

  disconnectedCallback() {
    window.removeEventListener('resize', this.handleResize);
  }
}
```

**Pattern**: Manual event listener management with explicit binding and cleanup in lifecycle methods.

### 3. Global Singleton Pattern for Utilities

Tooltip and utility components are often created as global singletons:

```javascript
const TOOLTIP = new SimpleTooltip();
document.body.append(TOOLTIP);

const DATES_TOOLTIP = new SimpleTooltip();
DATES_TOOLTIP.classList.add('reset', 'pointer-events-none');
document.body.append(DATES_TOOLTIP);
```

**Pattern**: Global instances for shared UI components, especially tooltips and overlays.

### 4. Mixed React-CanJS Integration

Components embed React components using createRoot and createElement:

```javascript
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import PercentComplete from '../../react/reports/GanttReport/PercentComplete';

// Later in code:
const root = createRoot(container);
root.render(createElement(PercentComplete, { percentage: value }));
```

**Pattern**: Direct React component embedding within CanJS templates for complex widgets.

### 5. Stache Template Functions

Standalone stache functions for reusable templates:

```javascript
const datesTooltipStache = stache(`<div class='flex gap-0.5 p-1'>
  {{# if(this.startDate)}}
  <div class="text-xs rounded-[3px] text-white bg-neutral-801 py-0.5 px-1.5">{{this.startDate}}</div>
  {{/ }}
  {{# if(this.businessDays) }}
    <div class="text-xs rounded-[3px] text-white bg-neutral-801 py-0.5 px-1.5">{{this.businessDays}}</div>
  {{/ }}
</div>`);
```

**Pattern**: Stache template functions for dynamic content generation outside of component templates.

### 6. Functional Component Pattern

Non-class components are implemented as plain functions that return DOM:

```javascript
function container({ addedClasses, currentValue, oldValue, title }) {
  return `<div class="flex-col justify-items-center px-1 py-3 rounded-md border ${addedClasses || ''}">
      <div class="text-sm font-semibold">${title}</div>
      <div class="flex justify-center gap-1 items-baseline">
        <div>${currentValue}</div>
        ${
          oldValue !== undefined
            ? `<div class="bg-neutral-801 rounded-sm text-xs text-white px-1">${oldValue}</div>`
            : ``
        }
      </div>
    </div>`;
}
```

**Pattern**: Template literal functions for dynamic HTML generation with conditional rendering.

### 7. Data Binding Conventions

CanJS data binding uses distinctive syntax patterns:

```javascript
// One-way binding
data: from = 'this.statuses';
inputPlaceholder: from = 'this.inputPlaceholder';

// Two-way binding
selected: bind = 'this.selectedStatuses';

// Event binding
on: click = 'this.remove(item, scope.event)';
on: focus = 'this.suggestItems(scope.element.value)';
on: input = 'this.suggestItems(scope.element.value)';
```

**Pattern**: Colon-separated binding syntax with explicit direction indicators.

### 8. Lifecycle Method Integration

Components integrate with CanJS lifecycle methods for setup and teardown:

```javascript
connected() {
  this.listenTo(window, 'click', (event) => {
    if (!this?.TOOLTIP?.showingSuggestions) {
      return;
    }
    // Handle click outside logic
  });
}
```

**Pattern**: `connected()` method for component initialization and event listener setup.

### 9. Type Definitions in Props

Props include type definitions with defaults:

```javascript
static props = {
  data: { type: type.Any },
  selected: { type: type.Any },
  showingSuggestions: { type: Boolean, default: false },
  statuses: {
    get default() {
      return [];
    },
  },
};
```

**Pattern**: Type specifications with getter functions for complex defaults.

### 10. Nested Component Architecture

Components often contain other custom components with data passing:

```javascript
// Parent component contains child with data binding
<auto-complete data:from="this.statuses" selected:bind="this.selectedStatuses"></auto-complete>;

// Child component creates nested components
TOOLTIP.belowElementInScrollingContainer(
  this,
  new AutoCompleteSuggestions().initialize({
    searchTerm,
    data: matches,
    add: this.add.bind(this),
  }),
);
```

**Pattern**: Programmatic component instantiation with initialization data.

## File Structure Conventions

- **Component files**: Named with kebab-case matching the custom element name
- **Directory organization**: Grouped by functionality (controls, reports, ui, routing)
- **Registration**: Immediate `customElements.define()` after class definition
- **Imports**: CanJS imports from centralized `can.js` file

## Integration Patterns

- **React Integration**: Direct embedding using createRoot for complex widgets
- **Global State**: Integration with route data and observable state management
- **Event Handling**: Mix of CanJS event binding and native DOM event listeners
- **Styling**: Tailwind CSS classes with custom design system tokens

This component architecture enables sophisticated data visualization and interaction patterns while maintaining the reactive benefits of CanJS observables and data binding.
