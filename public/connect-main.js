
import mainHelper from './shared/main-helper.js';

export default async function main(config) {
	const loginComponent = await mainHelper(config, 'jira');

	loginComponent.isLoggedIn = true;

	return loginComponent;
}
