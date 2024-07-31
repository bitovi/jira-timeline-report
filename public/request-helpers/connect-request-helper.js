import responseToJSON from "../shared/response-to-json";

async function fetchJSON(url, options) {
	return fetch(url, options).then(responseToJSON)
}
/*https://5580-68-187-209-164.ngrok-free.app/connect?
xdm_e=https%3A%2F%2Fbmomberger-bitovi.atlassian.net&
xdm_c=channel-bitovi.timeline-report__main
cp=
xdm_deprecated_addon_key_do_not_use=bitovi.timeline-report&
lic=none
&cv=1001.0.0-SNAPSHOT*/
export function getConnectRequestHelper() {
  return function(requestUrl) {
    return new Promise(async(resolve, reject) => {
      try {
        let result;
        if(requestUrl.startsWith('https://')) {
          result = await fetchJSON(
            requestUrl,
            {
/*              headers: {
                'Authorization': `Bearer ${requestJWT}`,
              }
*/            }
          );
        } else {
          result = JSON.parse((await AP.request(`/rest/${requestUrl}`)).body)
        }
        resolve(result);
      }
      catch(ex) {
        reject(ex);
      }
    })
  }

}