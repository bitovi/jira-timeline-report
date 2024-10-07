import { RoutePushstate, route, diff } from "../can.js";

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

const underlyingReplaceState = history.replaceState;


export const pushStateObservable = new RoutePushstate();
route.urlData = new RoutePushstate();
route.urlData.root = window.location.pathname;


const dateMatch = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function saveJSONToUrl(key, defaultValue, Type, converter = JSON){
	const {stringify, parse} = converter;
	
	return {
			type: Type,
      value({ lastSet, listenTo, resolve }) {
        const defaultJSON = stringify(typeof defaultValue === "function" ? defaultValue.call(this) : defaultValue);

        function resolveFromUrl(){
          const parsed = parse( new URL(window.location).searchParams.get(key) || defaultJSON );
          if(parsed && dateMatch.test(parsed)) {
            resolve( new Date(parsed) );
          } else {
            resolve( parsed );
          }
        }

        if (lastSet.value) {
          resolve(lastSet.value)
        } else {
          resolveFromUrl()
        }
        
        listenTo(lastSet, (value) => {
          const valueJSON = stringify(value);
          updateUrlParam(key, valueJSON, defaultJSON)
        });

        listenTo(pushStateObservable, ()=>{
          resolveFromUrl();
        });
      }
  }
}

export function makeArrayOfStringsQueryParamValue(queryParam){
  return {
      value: function({resolve, lastSet, listenTo}){
          function urlValue(){
              let value = new URL(window.location).searchParams.get(queryParam);
              return !value ? [] : value.split(",")
          }
          let currentValue = urlValue();
          resolve(currentValue);
  
          listenTo(lastSet, (value)=>{
              if(!value) {
                  value = "";
              } else if( Array.isArray(value) ){
                  value = value.join(",")
              }
              updateUrlParam(queryParam, value, "");
          });
  
          listenTo(pushStateObservable, (ev)=>{
              let newValue = urlValue();
              if(diff.list(newValue, currentValue).length) {
                  resolve(currentValue = newValue);
              }
          })
      }
  }
}

export function directlyReplaceUrlParam(key, valueJSON, defaultJSON) {
  const newUrl = new URL(window.location);
  if(valueJSON !== defaultJSON) {
    newUrl.searchParams.set(key, valueJSON );
  } else {
    newUrl.searchParams.delete(key );
  }
  underlyingReplaceState.call(history, {}, '', newUrl.search);
  //pushStateObservable.value = newUrl.search;
}

export function updateUrlParam(key, valueJSON, defaultJSON) {
  const newUrl = new URL(window.location);
  if(valueJSON !== defaultJSON) {
    newUrl.searchParams.set(key, valueJSON );
  } else {
    newUrl.searchParams.delete(key );
  }
  pushStateObservable.value = newUrl.search;
  //history.pushState({}, '', );
}