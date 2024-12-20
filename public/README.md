Proposed short-term folder organization:

- css - custom CSS classes. These should be minimum because we are using tailwind.
- examples - Example data to load

- jira - functionality specific to operating on Jira data
- jira-oidc-helpers - functionality to load jira data
- jira-request-helpers - stateful (but framework agnostic) request helpers

- react - All react code
- canjs - All CanJS code (minus the main component)
  - reports - the main reports you can select in the reports dropdown 
  - controls - controls that are aware of the specifics of the baseline report
  - ui - controls that are pure UI
  - routing - routing helpers

- main - main functions and the CanJS main component, other items that are injected into builds


- utils - Pure JS utilities unaware of Jira data 