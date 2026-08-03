I'd like to solve a few problems related to the autoscheduler:

- I want the critical path report to be more accessible while folks are looking at the autoscheduler. It's at the bottom of the page and folks might not even see it.

- The critical path report doesn't look great.

- I want the critical path report to be shown in a report of reports without the full autoscheduler. It should only show the top 5 with a "show more" capability.

I added spec/024-critical-path/critical-path.png so you could see what the critical path looks like now

and I put in spec/024-critical-path/autoscheduler.png so you could see what the autoscheduler looks like now

A few considerations:

- If we want the critical path report to show critical paths in a report-of-report, the autoscheduler would need to run. We'd still want to have some sort of special loading for the critical path to show that it is running the autoscheduler.

- It would also help if the critical path report could have a little call out for the teams that have the most `total working days`. This would help
  identify the teams who might be over capacitated.

A few options I've thought about (but I want you to think creatively for alternatives):

- Make the critical path report its own report. But it's also possible to see it via a button in the autoscheduler menu that will show a listing of the critical paths in a dropdown. Folks could then click to focus on that critical path in the autoscheduler, or have a different button that would open up the full critical path report.

- Enable a toggle if the autoscheduler should show the "timeline" vs "critical paths" and make this a param that can be saved as part of a saved report.
