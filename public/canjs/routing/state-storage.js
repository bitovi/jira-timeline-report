import { RoutePushstate, route, diff } from "../../can.js";

export function saveToLocalStorage(key, defaultValue) {
  return {
    value({ lastSet, listenTo, resolve }) {
      resolve(JSON.parse(localStorage.getItem(key)) || defaultValue);

      listenTo(lastSet, (value) => {
        localStorage.setItem(key, JSON.stringify(value));
        resolve(value);
      });
    },
  };
}

const underlyingReplaceState = history.replaceState;

export const pushStateObservable = new RoutePushstate();
pushStateObservable.replaceStateKeys.push("compareTo");
route.urlData = pushStateObservable;
route.urlData.root = window.location.pathname;
route.register("");

const dateMatch = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function saveJSONToUrl(key, defaultValue, Type, converter = JSON) {
  const { stringify, parse } = converter;

  return {
    type: Type,
    value({ lastSet, listenTo, resolve }) {
      const defaultJSON = stringify(typeof defaultValue === "function" ? defaultValue.call(this) : defaultValue);

      function resolveFromUrl() {
        const parsed = parse(new URL(window.location).searchParams.get(key) || defaultJSON);
        if (parsed && dateMatch.test(parsed)) {
          resolve(new Date(parsed));
        } else {
          resolve(parsed);
        }
      }

      if (lastSet.value) {
        resolve(lastSet.value);
      } else {
        resolveFromUrl();
      }

      listenTo(lastSet, (value) => {
        const valueJSON = stringify(value);
        updateUrlParam(key, valueJSON, defaultJSON);
      });

      listenTo(pushStateObservable, () => {
        resolveFromUrl();
      });
    },
  };
}

export function saveJSONToUrlButAlsoLookAtReportData(key, defaultValue, Type, converter = JSON) {
  const { stringify, parse } = converter;

  function parseThatHandlesDates(value) {
    const parsed = parse(value);
    if (parsed && dateMatch.test(parsed)) {
      return new Date(parsed);
    } else {
      return parsed;
    }
  }

  return makeParamAndReportDataReducer({
    // what key you are listening to
    key,
    
    // given a raw value, what is the "JS" value 
    parse: parseThatHandlesDates,
  
    // given a value, what's a string
    stringify,
    Type,
    defaultValue
  });
}

/*
export function saveJSONToUrlButAlsoLookAtReportData1(key, defaultValue, Type, converter = JSON) {
  const { stringify, parse } = converter;

  return {
    type: Type,
    enumerable: true,
    value({ lastSet, listenTo, resolve }) {

      const defaultJSON = stringify(typeof defaultValue === "function" ? defaultValue.call(this) : defaultValue);

      let state = {
        urlValue: undefined,
        reportData: undefined
      }

      listenTo("reportData",({value})=> reportDataChanged(value));
      reportDataChanged(this.reportData);
      function reportDataChanged(reportData){
        if(!reportData) {
          resolveValueFromState(state, "reportData", undefined);
        } else {
          resolveValueFromState(state, "reportData",paramValue(reportData, key));
        }
      }

      listenToUrlChange(key, listenTo, (value)=> {
        resolveValueFromState(state, "urlValue", value);
      });

      function _resolveValueFromState(state, event, data){
        const newState = {
          ...state,
          [event]: data
        }
        // if the URL has a value, use it no matter what
        if(newState.urlValue) {
          parseAndResolve(newState.urlValue)
        } 
        // then see if we have report data
        else if(newState.reportData){
          parseAndResolve(newState.reportData)
        }
        // then use the default
        else {
          parseAndResolve(defaultJSON)
        }
        return newState;
      }
      function resolveValueFromState() {
        state = _resolveValueFromState.apply(this, arguments);
      }

      function parseAndResolve(value) {
        const parsed = parse(value);
        if (parsed && dateMatch.test(parsed)) {
          resolve(new Date(parsed));
        } else {
          resolve(parsed);
        }
      }
      
      
      function resolveFromUrl() {
        const parsed = parse(new URL(window.location).searchParams.get(key) || defaultJSON);
        if (parsed && dateMatch.test(parsed)) {
          resolve(new Date(parsed));
        } else {
          resolve(parsed);
        }
      }

      if (lastSet.value) {
        resolve(lastSet.value);
      } 

      listenTo(lastSet, (value) => {
        const valueJSON = stringify(value);
        const param = this.reportData && paramValue(this.reportData, key);
        if(param) {
          // console.log("ROUTE",key,"set, but using", param,"from reportData as a default value");
          updateUrlParam(key, valueJSON, param);
        } else {
          updateUrlParam(key, valueJSON, defaultJSON);
        }
        
      });

    },
    serialize( currentValue ) {
      return stringify(currentValue);
    }
  };
}*/
/*
export function makeArrayOfStringsQueryParamValue(queryParam) {
  return {
    value: function ({ resolve, lastSet, listenTo }) {
      function urlValue() {
        let value = new URL(window.location).searchParams.get(queryParam);
        return !value ? [] : value.split(",");
      }
      let currentValue = urlValue();
      resolve(currentValue);

      listenTo(lastSet, (value) => {
        if (!value) {
          value = "";
        } else if (Array.isArray(value)) {
          value = value.join(",");
        }
        updateUrlParam(queryParam, value, "");
      });

      listenTo(pushStateObservable, (ev) => {
        let newValue = urlValue();
        if (diff.list(newValue, currentValue).length) {
          resolve((currentValue = newValue));
        }
      });
    },
    enumerable: true,
    serialize( currentValue ) {
      return stringify(currentValue);
    }
  };
}*/

// a base helper function
export function makeParamAndReportDataReducer({
  // what key you are listening to
  key,
  
  // given a raw value, what is the "JS" value 
  parse,

  // given a value
  stringify,

  // by default looks at the url data first, then report data, then the default value
  proposeValueFromState = function proposeValueFromState(state, proposeNewSerializedValue, change) {
    if(state.urlParamValue != null) {
      proposeNewSerializedValue(state.urlParamValue)
    } 
    // then see if we have report data
    else if(state.reportParamValue != null){
      proposeNewSerializedValue(state.reportParamValue)
    }
    // then use the default
    else {
      proposeNewSerializedValue(state.defaultValue)
    }
  },

  // what you should listen to other than yourself ...
  listeners,


  checkIfChanged,
  Type,
  defaultValue
}) {
  return {
    Type: Type,
    value: function ({ resolve, lastSet, listenTo }) {
      const defaultJSON = stringify(typeof defaultValue === "function" ? defaultValue.call(this) : defaultValue);

      let state = {reportParamValue: undefined, urlParamValue: undefined, defaultValue: defaultJSON};
      let currentValue = undefined;

      function proposeNewSerializedValue(newValue){
        const parsed = parse(newValue);
        // if there's a change and onValueChange optionally tells us it's ok to change
        if( parsed !== currentValue && (checkIfChanged ? checkIfChanged(parsed, currentValue) : true ))  {
          currentValue = parsed;
          resolve(parsed)
        }
      }

      listenToReportDataChanged(this, key, listenTo, (reportParamValue)=>{
        state.reportParamValue = reportParamValue;
        proposeValueFromState(state, proposeNewSerializedValue, "reportParamValue");
      })
      listenToUrlChange(key, listenTo, (urlParamValue)=> {
        state.urlParamValue = urlParamValue;
        proposeValueFromState(state, proposeNewSerializedValue, "urlParamValue");
      });

      /*
      for(const [name, handler] of Object.entries(listeners || {})) {
        listenTo(name, (...args)=>{
          handler.apply(this, {resolveFromState, state, parse, resolve, ...args)
        })
      }*/



      function parseAndResolve(value){
        const newValue = !value ? [] : value.split(",");
        // current value won't be an array the first change, so we should always resolve
        if(!Array.isArray(currentValue)) {
          resolve(currentValue = newValue)
        } else if (diff.list(newValue, currentValue).length) {
          resolve((currentValue = newValue));
        }
      }
      
      listenTo(lastSet, (value) => {
        const serialized = stringify(value);
        const reportParam = this.reportData && paramValue(this.reportData, key);
        updateUrlParam(key, serialized, reportParam || "");
      });
    },
    enumerable: true,
    serialize( currentValue ) {
      return stringify(currentValue);
    }
  };
}
export function makeArrayOfStringsQueryParamValueButAlsoLookAtReportData(key) {
  return makeParamAndReportDataReducer({
    // what key you are listening to
    key,
    
    // given a raw value, what is the "JS" value 
    parse(value){
      return !value ? [] : value.split(",")
    },
    // given a value
    stringify(value){
      if (!value) {
        return "";
      } else if (Array.isArray(value)) {
        return value.join(","); // we probably need to escape things with `,`
      } else {
        return JSON.stringify(value);
      }
    },

    checkIfChanged(newValue, currentValue) {
      if(!Array.isArray(currentValue)) {
        return true;
      } else if (diff.list(newValue, currentValue).length) {
        return true;
      }
    },
    defaultValue: ""
  })
}
/*
export function makeArrayOfStringsQueryParamValueButAlsoLookAtReportData(key) {
  return {
    value: function ({ resolve, lastSet, listenTo }) {
      let state = {
        reportParamValue: undefined,
        urlParamValue: undefined
      }
      let currentValue = undefined;

      listenToReportDataChanged(this, key, listenTo, (reportParamValue)=>{
        state.reportParamValue = reportParamValue;
        resolveFromState(state);
      })
      listenToUrlChange(key, listenTo, (urlParamValue)=> {
        state.urlParamValue = urlParamValue;
        resolveFromState(state);
      });

      function resolveFromState() {
        if(state.urlParamValue != null) {
          parseAndResolve(state.urlParamValue)
        } 
        // then see if we have report data
        else if(state.reportParamValue != null){
          parseAndResolve(state.reportParamValue)
        }
        // then use the default
        else {
          parseAndResolve("")
        }
      }

      function parseAndResolve(value){
        const newValue = !value ? [] : value.split(",");
        // current value won't be an array the first change, so we should always resolve
        if(!Array.isArray(currentValue)) {
          resolve(currentValue = newValue)
        } else if (diff.list(newValue, currentValue).length) {
          resolve((currentValue = newValue));
        }
      }
      function serialize(value){
        if (!value) {
          return "";
        } else if (Array.isArray(value)) {
          return value.join(","); // we probably need to escape things with `,`
        } else {
          return JSON.stringify(value);
        }
      }
      
      listenTo(lastSet, (value) => {
        const serialized = serialize(value);
        const reportParam = this.reportData && paramValue(this.reportData, key);
        updateUrlParam(key, serialized, reportParam|| "");
      });
    },
    enumerable: true,
    serialize( currentValue ) {
      return serialize(currentValue);
    }
  };
}
*/
export function directlyReplaceUrlParam(key, valueJSON, defaultJSON) {
  const newUrl = new URL(window.location);
  if (valueJSON !== defaultJSON) {
    newUrl.searchParams.set(key, valueJSON);
  } else {
    newUrl.searchParams.delete(key);
  }
  underlyingReplaceState.call(history, {}, "", newUrl.search);
  //pushStateObservable.value = newUrl.search;
}

export function updateUrlParam(key, valueJSON, defaultJSON) {
  const newUrl = new URL(window.location);
  if (valueJSON !== defaultJSON) {
    newUrl.searchParams.set(key, valueJSON);
  } else {
    newUrl.searchParams.delete(key);
  }
  pushStateObservable.value = newUrl.search;
  //history.pushState({}, '', );
}

export function paramValue(reportData, key){
  return new URLSearchParams(reportData.queryParams).get(key);
}

export function listenToReportDataChanged(routeData, key, listenTo, onReportDataChanged){
  listenTo("reportData",({value})=> reportDataChanged(value));
  reportDataChanged(routeData.reportData);
  function reportDataChanged(reportData){
    if(!reportData) {
      onReportDataChanged(undefined);
    } else {
      onReportDataChanged(paramValue(reportData, key));
    }
  }
}

export function listenToUrlChange(key, listenTo, onUrlChange) {
  listenTo(pushStateObservable, routeChanged);
  routeChanged();
  function routeChanged() {
    onUrlChange( new URL(window.location).searchParams.get(key) );
  }
}