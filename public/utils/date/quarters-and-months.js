function monthDiff(dateFromSring, dateToString) {
    const dateFrom = new Date(dateFromSring);
    const dateTo = new Date(dateToString);
    return dateTo.getMonth() - dateFrom.getMonth() + 12 * (dateTo.getFullYear() - dateFrom.getFullYear());
}

export function getQuartersAndMonths(startDate, endDate){
	// figure out which quarters startDate and endDate are within
	const quarterStartDate = new Date(
			startDate.getFullYear(),
			Math.floor(startDate.getMonth() / 3) * 3
	);

	const lastQuarterEndDate = new Date(
			endDate.getFullYear(),
			Math.floor(endDate.getMonth() / 3) * 3 + 3
	);


	let result = '';

	// Html monthly block to make 1 quater
	let accumulatedCalendarQuaterHtml = '';

	// if quater change we will create a new HTML block
	let previousQuater = null;

	// keep track of release indexes
	const monthDiffResult = monthDiff(quarterStartDate, lastQuarterEndDate);
	const quarters = monthDiffResult / 3;
	if(!Number.isInteger(quarters)) {
		console.warn("Not an even number of quarters", monthDiffResult,"/ 3");
	}

	function month(d) {
			return d.toLocaleString('default', { month: 'short' });
	}

	const quartersList = [];
	const months = []

	for (let i = 0; i < quarters; i++) {
		const firstMonth = new Date(quarterStartDate);
		firstMonth.setMonth(firstMonth.getMonth() + i * 3);
		const secondMonth = new Date(quarterStartDate);
		secondMonth.setMonth(secondMonth.getMonth() + i * 3 + 1);
		const thirdMonth = new Date(quarterStartDate);
		thirdMonth.setMonth(thirdMonth.getMonth() + + i * 3 + 2);

		quartersList.push({
			number: Math.floor(firstMonth.getMonth() / 3) + 1,
			name: "Q"+ (Math.floor(firstMonth.getMonth() / 3) + 1)
		});

		months.push({
			first: true,
			name: month(firstMonth)
		});
		months.push({
			name: month(secondMonth)
		})
		months.push({
			last: true,
			name: month(thirdMonth)
		})
	}

	const lastDay = new Date(quarterStartDate);
	lastDay.setMonth(lastDay.getMonth() + monthDiffResult);

	return {
		quarters: quartersList,
		months,
		firstDay: quarterStartDate,
		lastDay
	};
}