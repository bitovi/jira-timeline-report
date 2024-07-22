import semver from "./semver.js";
import uniqueTrailingNames from "./shared/unique-trailing-names.js";
import { epicTimingData } from "./date-helpers.js";



export default function(releases){

	return releases.map( (releaseObject) => {
		return {
				...releaseObject,
				shortName: releaseObject.release, //shortReleaseNames[index],
				version: releaseObject.release,
				shortVersion: releaseObject.release
		};
	}).sort( (a, b) => {
		return a.dateData.rollup.due - b.dateData.rollup.due;
	});


	/*const semverReleases = Object.keys(releasesToInitiatives).sort( (a, b)=> {
		const initiatives = releasesToInitiatives[a];

		debugger;
		epicTimingData();
		return 1;
	});

	const shortReleaseNames = uniqueTrailingNames(semverReleases);

	return semverReleases.map( (release, index)=>{

	})*/
}
