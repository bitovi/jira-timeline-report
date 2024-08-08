export default function chunkArray(array, size) {
	const chunkedArr = [];
	for (let i = 0; i < array.length; i += size) {
	  chunkedArr.push(array.slice(i, i + size));
	}
	return chunkedArr;
}