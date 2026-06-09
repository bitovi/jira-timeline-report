# CanJS Components Style Guide

## Unique Patterns

### StacheElement Custom Elements

Legacy components use CanJS StacheElement pattern:

```javascript
export class TimelineReport extends StacheElement {
  static view = `<div class="timeline-report">...</div>`;
  static props = {
    // Component properties
  };
}
customElements.define('timeline-report', TimelineReport);
```

### Observable Integration

Direct integration with CanJS observables:

```javascript
import { ObservableObject, value } from '../can';

export default new ObservableObject({
  primaryReportType: value.from('primaryReportType'),
  selectedProjectKey: value.from('selectedProjectKey'),
});
```
