import { test as base, expect } from "@playwright/test";

interface Log {
    msg: any;
    type: string;
}

interface Error {
    name: string,
    message: string
}

// export the extended `test` object
export const test = base.extend<{ page: void; failOnJSError: boolean; displayAsciiTable: boolean; }>({
    // The metadata { option: true } allows these options to be configurable by the user.
    failOnJSError: [true, { option: true }],
    displayAsciiTable: [true, { option: true }],

    page: async ({ page, failOnJSError, displayAsciiTable }, use) => {
        const errors: Array<Error> = [];
        const logs: Log[] = [];

        /* throw Error() -  raises an exception in the current code block and causes it to exit, or to flow to the next catch statement if raised in a try block. */
        
        /* console.error() just prints out a red message to the browser developer tools' JavaScript console and does not cause any changes in the execution flow. */

        page.addListener("pageerror", (err) => {
            errors.push(err);
        });

        // Listen for all console logs  
        page.on('console', (msg) => {
            logs.push({ msg: msg.text(), type: msg.type() });
        });

        await use(page);

        // Count occurrences of each error type and log type
        const errorCounts = errors.reduce((accumulator, error) => {
            const errorName = error.name || "UnknownError";
            accumulator[errorName] = (accumulator[errorName] || 0) + 1;
            return accumulator;
        }, {} as Record<string, number>);

        const logCounts = logs.reduce((accumulator, log) => {
            accumulator[log.type] = (accumulator[log.type] || 0) + 1;
            return accumulator;
        }, {} as Record<string, number>);

        // Function to generate an ASCII table
        function printTable(title: string, data: Record<string, number>) {
            if (Object.keys(data).length === 0) return; // Do not print empty tables

            console.log(`\n${title}`);
            console.log("+-------------------------+----------------+");
            console.log("| Type                    | Count          |");
            console.log("+-------------------------+----------------+");
            for (const [type, count] of Object.entries(data)) {
                console.log(`| ${type.padEnd(23)} | ${count.toString().padEnd(14)} |`);
            }
            console.log("+-------------------------+----------------+\n");
        }

        function printErrors() {
            console.log("**************************************************");
            console.log("******************* ERRORS FOUND *****************");
            console.log("**************************************************\n");

            if (errors.length > 0) {
                printTable("Error Summary", errorCounts);
            } else {
                console.log("No errors found.");
            }

            console.log("**************************************************\n");
        }

        function printConsoleLogs() {
            console.log("==================================================");
            console.log("================ CONSOLE LOG SUMMARY =============");
            console.log("==================================================\n");

            console.log(`${logs.length} console logs`);
            if (logs.length > 0) {
                printTable("Console Log Summary", logCounts);
                const errorLogs = logs.filter(log => log.type === 'error');
                const errorLogsCount = errorLogs.length;
                console.log(`Total Console Log Errors: ${errorLogsCount}`);

                // Print error logs but truncate them to 100 characters
                errorLogs.forEach(log => {
                    const truncatedMsg = log.msg.length > 100 ? `${log.msg.slice(0, 100)}...` : log.msg;
                    console.log(`Error: ${truncatedMsg}`);
                });
            }

            console.log("==================================================\n");
        }

        if (displayAsciiTable) {
            printErrors();
            printConsoleLogs();
        }

        if (failOnJSError) {
            expect(errors).toHaveLength(0);
        }
    },
});

// export Playwright's `expect`
export { expect } from "@playwright/test";
