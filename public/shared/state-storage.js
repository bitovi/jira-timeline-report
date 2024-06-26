export function saveToLocalStorage(key, defaultValue) {
  return {
    value({lastSet, listenTo, resolve}) {
      resolve( JSON.parse( localStorage.getItem(key) ) || defaultValue );

      listenTo(lastSet, (value)=> {
        localStorage.setItem(key, JSON.stringify(value));
        resolve(value);
      })
    }
  }
}

const dateMatch = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function saveJSONToUrl(key, defaultValue, Type, converter = JSON){
	const {stringify, parse} = converter;
	
	return {
			type: Type,
      value({ lastSet, listenTo, resolve }) {
          const defaultJSON = stringify(typeof defaultValue === "function" ? defaultValue.call(this) : defaultValue);
          if (lastSet.value) {
              resolve(lastSet.value)
          } else {
							const parsed = parse( new URL(window.location).searchParams.get(key) || defaultJSON );
							if(parsed && dateMatch.test(parsed)) {
								resolve( new Date(parsed) );
							} else {
								resolve( parsed );
							}
          }

          listenTo(lastSet, (value) => {
							const valueJSON = stringify(value);
              updateUrlParam(key, valueJSON, defaultJSON)
              resolve(value);
          })
      }
  }
}

export function updateUrlParam(key, valueJSON, defaultJSON) {
  const newUrl = new URL(window.location);
  if(valueJSON !== defaultJSON) {
    newUrl.searchParams.set(key, valueJSON );
  } else {
    newUrl.searchParams.delete(key );
  }
  history.pushState({}, '', newUrl);
}