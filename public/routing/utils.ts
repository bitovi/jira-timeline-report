type ParamsObject = Record<string, string | string[] | undefined>;

export function queryStringToObject(queryString: string): ParamsObject {
  const params = new URLSearchParams(queryString);
  const result: ParamsObject = {};

  console.log({ params: params.get("jql") });

  for (const [key, value] of params.entries()) {
    // If the key already exists, convert it to an array to store multiple values
    if (result[key]) {
      if (Array.isArray(result[key])) {
        result[key].push(value);
      } else {
        result[key] = [result[key], value];
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

export function objectToQueryString(paramsObject: ParamsObject): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(paramsObject)) {
    if (!value) {
      continue;
    }

    if (Array.isArray(value)) {
      // If the value is an array, append each value separately
      value.forEach((val) => params.append(key, decodeURIComponent(val)));
    } else {
      params.append(key, decodeURIComponent(value));
    }
  }

  return params.toString();
}
