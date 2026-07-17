I want to think through how we could support a "report of reports" in SR4J (status reports for jira).

I was thinking a report that users can select other saved reports.

It would then show all of them sequentially.

## Considerations

### Load times

If reports have the same jql source (and fields), we'd want to only get that data once and then share it with the reports using it.

We might be able to even share roll up data, but if not, it's ok if they all recalculate based on their settings.

### Saving the report

How is report data saved?

I think this report would have some sort of "reports" array which would be the UUIDs of the saved reports.

### UI

Folks could pick from the list of saved reports.

In full screen, the picker would be removed.

We'd also need some way of deleting, replacing or inserting a report.
