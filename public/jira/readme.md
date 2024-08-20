## Structure 

Folders for issue data:

- `/raw` - helpers that operate on raw data returned from Jira
- `/normalized` - a function that takes raw data and normalizes it to useful values. For example, some 
  Jira configurations might use `Estimated Story Points` instead of `Story points`.  
- `/derived` - helper functions that build from a SINGLE issue's normalized data.  For instance, calculating
  the amount of time between `start date` and `due date`.
- `/rollup` - helper functions that roll up data across multiple issues, specifically across parent/child relationships.

Folders for other data types:

- `/releases`