export function createLinearMapping(mappingPoints) {
    // Ensure the mapping points are sorted by input value
    mappingPoints.sort((a, b) => a[0] - b[0]);

    return function(value) {
        // Handle values outside the range
        if (value <= mappingPoints[0][0]) return mappingPoints[0][1];
        if (value >= mappingPoints[mappingPoints.length - 1][0]) return mappingPoints[mappingPoints.length - 1][1];

        // Find the two points the value falls between
        for (let i = 0; i < mappingPoints.length - 1; i++) {
            const [x1, y1] = mappingPoints[i];
            const [x2, y2] = mappingPoints[i + 1];

            if (value >= x1 && value <= x2) {
                // Perform linear interpolation
                const t = (value - x1) / (x2 - x1); // Proportion between the two points
                return y1 + t * (y2 - y1); // Interpolated value
            }
        }
    };
}

export function createInverseMapping(mappingPoints) {
    // Swap x and y in the mapping points to create the inverse mapping
    const invertedPoints = mappingPoints.map(([x, y]) => [y, x]);

    // Use the same createLinearMapping logic on the inverted points
    return createLinearMapping(invertedPoints);
}