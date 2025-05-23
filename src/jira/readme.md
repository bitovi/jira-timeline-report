### Data Flow Explanation

![image](https://github.com/user-attachments/assets/61d4f973-3a54-48e7-bd8a-5f53deb69ee1)

The data flow of the tool is structured to move from raw data fetching to the final report, with each folder playing a critical role in the process:

#### 1. **Jira Raw Data**

- The tool begins by fetching raw data from Jira. This data includes tasks, epics, and releases, forming the foundation for all further operations.

#### 2. **`/raw` (Data Fetching)**

- Raw data from Jira is retrieved and organized into a format that the tool can process.

#### 3. **`/normalized` (Data Normalization)**

- The fetched raw data is passed through a normalization process. This ensures consistency across different Jira configurations, making the data easier to work with for further calculations.

#### 4. **`/derived` (Derived Metrics)**

- After normalization, additional metrics are derived from a single issue’s normalized data. These metrics might include timing (how long work will take) and status (e.g., on track, delayed, or blocked).

#### 5. **`/rollup` (Data Aggregation)**

- In this step, the tool aggregates data by grouping child tasks under parent tasks (e.g., stories under epics) and rolling up their data. This provides a high-level overview of progress across various tasks.

#### 6. **Final Report**

- The final output is a report that displays rolled-up data, showing the progress and status of work at multiple levels (task, epic, release). This report provides insights into the overall health and status of projects.

---

## Structure

The tool organizes its functionality across several folders, each responsible for handling different types of data or operations. Here's an overview of the folder structure and their roles:

### Folders for Issue Data:

- **`/raw`**: Contains helpers that operate on raw data fetched from Jira. This raw data includes tasks, epics, and releases.
- **`/normalized`**: Contains functions that take raw data and normalize it into consistent, usable formats. For example, some Jira configurations might use `Estimated Story Points` instead of `Story points`. This normalization ensures uniformity across different configurations.

- **`/derived`**: Contains helper functions that calculate additional metrics from a _single issue's_ normalized data. For instance, these functions might calculate the time between the `start date` and `due date` of an issue.

- **`/rollup`**: Contains helper functions that aggregate data across multiple issues. This module is especially useful for rolling up data from child tasks to their parent tasks, such as summing up the total progress of stories under an epic.

### Folders for Other Data Types:

- **`/releases`**: Specializes in handling data related to releases, including normalizing and deriving release-specific information, such as versioning and tracking across projects.

---
