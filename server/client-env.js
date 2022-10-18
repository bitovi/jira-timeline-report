module.exports = function(){
	const env = {};
	for(let prop in process.env) {
		if(prop.startsWith("CLIENT_")) {
			env[prop.replace("CLIENT_","")] = process.env[prop];
		}
	}
	console.log(env);
	return env;
}
