# How other Jira apps store their data

Research done for [plan.md](./plan.md). The short version changed my recommendation, so read this
before the plan.

## Three strategies, and who picks each

| Strategy                                                           | Who uses it                                                      | What it costs                                                                        |
| ------------------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Native Jira objects** — issues, custom fields, entity properties | Xray Server/DC, most config-heavy apps, workflow apps            | Jira API rate limits; no transactions; data shape constrained by what Jira models    |
| **The app's own cloud backend**                                    | Xray _Cloud_, Zephyr Scale, eazyBI, Structure, BigPicture, Tempo | Infrastructure, SOC2, data residency work, "where does my data live" sales questions |
| **Atlassian-hosted (Forge)** — KVS, Custom Entity Store, Forge SQL | Newer/smaller apps; the direction Atlassian is pushing everyone  | 240 KiB per key, 4,000 writes/min; requires being a Forge app                        |

## The precedent that matters most: Xray

Xray is test management for Jira — tests, test sets, test plans, test executions. On
**Server/Data Center it stores all of that as native Jira issues** with custom fields for steps and
results, exactly the "one issue per record" shape we're considering for `STATREPS`. It's the
canonical proof the pattern works, and works at large scale.

**And then Xray Cloud moved off it.** In Xray for Jira Cloud, information previously held in Jira
custom fields was replaced with Xray entities stored _outside_ Jira, on Xray's own infrastructure.

That reversal is the most useful data point in this whole survey, and it's worth being precise about
why it doesn't transfer to us:

| Xray Cloud's problem                                                        | Does it apply to us?                                                                  |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Tens of thousands of test issues per customer; every execution creates more | **No.** We're talking ~100 reports and ~30 teams. Three orders of magnitude apart.    |
| Test data is written constantly by CI, at machine rate                      | **No.** A report is saved by a human, a few times a day at most.                      |
| Rich queries across structured test data that JQL can't express             | **No.** Our query is "list the reports in this project."                              |
| Test issues polluting customers' boards, backlogs, and issue counts         | **Partly** — but 100 issues in one project, versus tens of thousands across projects. |

The lesson isn't "don't store data as issues." It's **"issues stop working when your record count and
write rate look like a database's."** Ours don't, and won't. A saved report is much closer to a
Confluence page than to a test execution.

## Entity properties are the boring, correct answer for our size

The Atlassian developer community's own framing: entity properties are for data "tightly coupled to
a specific Atlassian entity," accessible through the REST API, with the tradeoff being 32 KB and no
rich querying. Apps that need more than that go to Forge storage or their own backend.

We are squarely in the entity-property size class. `{queryParams, sections}` for one report is
~500 bytes to a few KB. The only reason we're running out of room today is that we put _all_ the
records in _one_ property.

## The commercial argument nobody made in [019](../019-saved-data-options/README.md)

**Data residency.** Connect apps must implement realm pinning (`regionBaseUrls`) and realm migration
to keep app data in the customer's chosen region; apps that don't, store data wherever the vendor
does. Enterprise buyers ask about this, and "Status Reports for Jira stores nothing outside your
Jira" is a much stronger answer than a residency implementation.

Right now that answer is _already almost true_ — Connect app properties live in Atlassian's
infrastructure. Moving reports into the customer's own Jira project makes it unambiguously true, and
adds two things procurement likes: **reports appear in the customer's own Jira backups**, and
**reports survive uninstalling the app** (app properties do not).

Atlassian's "Runs on Atlassian" badge marks apps hosted entirely in Atlassian infrastructure with no
data egress. We can't earn it as a Connect app, but the `STATREPS` design moves us toward the same
property, and toward an easier Forge migration later — Forge storage would be a drop-in for the
pointer, and the project backend would be unchanged.

## What this survey rules out for us

**Our own backend.** Every app that took this path did so because Jira could not model or serve
their data volume. We have ~100 records that change a few times a day. Building a backend would add
infrastructure, a security review, a residency story, and a "where is my data" objection — to solve
a problem we don't have. If we ever build one, it should be because we want cross-site or
cross-product reporting, not because of storage.

**Forge, for now.** Strictly better primitives than Connect (240 KiB vs. 32 KB, real quotas, free
residency, the badge), but it's a platform migration and 240 KiB is still a blob — it raises the
ceiling and fixes none of the permissions/history/concurrency problems. Track it as its own effort.

## Conclusion

The market splits by data volume, and we are firmly on the small side of the split. **Native Jira
objects — issues for the records, entity properties for the payloads — is the proportionate answer
for an app our size**, it's the pattern the whole Server/DC ecosystem validated, and the reason its
most famous adopter abandoned it on Cloud is a scale problem we will not have.

## Sources

- [Xray Server/DC vs. Xray Cloud — architectural differences](https://docs.getxray.app/space/XRAYCLOUD/44564726)
- [What happens to Xray test data when Jira is restored](https://rewind.com/blog/xray-test-data-jira-restore/) — tests as Jira issues on Server/DC
- [Zephyr vs. Xray comparison](https://smartbear.com/blog/whats-the-difference-between-zephyr-and-xray/)
- [Where to store data in Forge apps](https://community.atlassian.com/forums/Jira-articles/Where-to-Store-Data-in-Forge-Apps/ba-p/2786721)
- [Entity properties or Forge storage — a performance comparison](https://community.atlassian.com/forums/Jira-articles/Entity-Properties-or-Forge-Storage-A-Performance-Battle-for/ba-p/2795677)
- [Jira Cloud — Entity Property module (JQL indexing)](https://developer.atlassian.com/cloud/jira/platform/modules/entity-property/)
- [Atlassian — understand data residency](https://support.atlassian.com/security-and-access-policies/docs/understand-data-residency/)
- [Data residency for Atlassian apps — Connect realm pinning, Runs on Atlassian](https://titanapps.io/blog/data-residency-for-atlassian)
