/**
 * this module is for getting text strings from an http response.
 */
export function responseToText(response: Response): Promise<string> {
  if (!response.ok) {
    return response.json().then((payload) => {
      const err = new Error('HTTP status code: ' + response.status);
      Object.assign(err, payload);
      Object.assign(err, response);
      throw err;
    });
  }
  return response.text();
}
