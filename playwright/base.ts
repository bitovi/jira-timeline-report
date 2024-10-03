import { test as base, expect } from "@playwright/test";

interface Log {
    msg: string;
    type: string;
}

// export the extended `test` object
export const test = base.extend<{ failOnJSError: boolean; displayAsciiTable: boolean }>({
    // The metadata { option: true } allows these options to be configurable by the user.
    failOnJSError: [true, { option: true }],
    displayAsciiTable: [true, { option: true }],

    page: async ({ page, failOnJSError, displayAsciiTable }, use) => {
        const errors: Array<Error> = [];
        const logs: Log[] = [];

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

        // Conditionally print the tables based on displayAsciiTable flag
        if (displayAsciiTable) {
            console.log(`${errors.length} errors`);
            if (errors.length > 0) {
                printTable("Error Summary", errorCounts);
            }

            console.log(`${logs.length} console logs`);
            if (logs.length > 0) {
                printTable("Console Log Summary", logCounts);
            }
        }

        // Ensure there are no errors
        if (failOnJSError) {
            expect(errors).toHaveLength(0);
        }
    },
});

// export Playwright's `expect`
export { expect } from "@playwright/test";