


const REPORT_COLORS = {}


const RULES = [
    {
        reportStatus: "Complete",
        rule: {
            "==": [
                {"var": "statusCategory"},
                "Done"
            ]
        }
    },
    {
        reportStatus: "Blocked",
        rule: {
            "selfOrAnyChild": [{
                "==": [
                    {"var": "status"},
                    "Blocked"
                ]
            }]
        }
    },
    {
        reportStatus: "Warning",
        rule: {
            "selfOrAnyChild": [{
                some: [
                    {"var": "label"},
                    {"==": [{var: ""}, "Warning"]}
                ]
            }]
        }
    },
    {
        reportStatus: "Ahead",
        rule: {
            ">": [{"var": "previous.calculated.due"},{"var": "calculated.due"}]
        }
    },
    {
        reportStatus: "Behind",
        rule: {
            "<": [{"var": "previous.calculated.due"},{"var": "calculated.due"}]
        }
    }
]