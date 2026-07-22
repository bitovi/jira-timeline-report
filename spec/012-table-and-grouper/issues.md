Some new issues:




- It shouldn't be called "Rows" for the sort vs hierarchy.  We need something better than this. It's very confusing. Also, the indention was to be on a single column with both the icon and the summary combined.  (The summary should be a link, but not look like it until hovered).
  Some options:
  - A special "Icon & Summary" column folks can add. It will have different 
    sort options like "hierarchy" where it will do the indentation and show
    the hierarchy or "summary" where it can just sort the summary.
  - I'd like you to brainstorm some options in subfolder within spec/012-table-and-grouper. Use a subagent. 


- Group By is limited to only team/parent/none. It should show all fields that are in the table.
- When I group by team it looks like: spec/012-table-and-grouper/Screenshot 2026-07-21 at 9.29.45 PM.png
  - WHy is the header "issue type" above the groupings? It should say team.
  - Why aren't the other non-identity fields 


- Similar to above, with this url: http://localhost:5173/?settings=SOURCES&jql=type+%3D+Outcome&loadChildren=true&selectedIssueType=Outcome&primaryReportType=table2&tableColumns=%5B%7B%22sourceId%22%3A%22identity%3AissueType%22%7D%2C%7B%22sourceId%22%3A%22identity%3Akey%22%7D%2C%7B%22sourceId%22%3A%22identity%3Asummary%22%7D%2C%7B%22sourceId%22%3A%22field%3Aproject%22%7D%5D&tableGroupBy=field%3Aproject&tableRowOrdering=sort
  - It looks like: spec/012-table-and-grouper/Screenshot 2026-07-21 at 9.33.26 PM.png
  - I've grouped by Project, why isn't that the first column header?  Why is project at the end?
  - Why aren't issue key and summary given any grouped values (preumably the list)

